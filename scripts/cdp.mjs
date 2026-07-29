/**
 * Chrome DevTools Protocol helper for Electron debugging
 * Usage: node cdp.mjs <command> [args...]
 *
 * Commands:
 *   pages              — list all pages
 *   screenshot <pageId> — take a screenshot (saved to screenshot.png)
 *   dom <pageId>        — get page DOM as HTML
 *   eval <pageId> <js>  — execute JavaScript in the page
 *   console <pageId>    — check console messages
 *   snap <pageId>       — accessibility tree snapshot
 */

const CDP_PORT = 8315
const BROWSER_WS = `ws://127.0.0.1:${CDP_PORT}/devtools/browser/50af5ba4-60ee-4436-a557-9af9a4908bbb`

async function connectBrowser() {
  const ws = new WebSocket(BROWSER_WS)
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve(ws))
    ws.addEventListener('error', reject)
  })
}

async function send(ws, method, params = {}) {
  const id = Math.floor(Math.random() * 100000)
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => {
    const handler = (msg) => {
      const data = JSON.parse(msg.data)
      if (data.id === id) {
        ws.removeEventListener('message', handler)
        if (data.error) reject(new Error(data.error.message))
        else resolve(data.result)
      }
    }
    ws.addEventListener('message', handler)
  })
}

async function connectPage(ws, pageId) {
  // Create a page target session
  const { sessionId } = await send(ws, 'Target.attachToTarget', {
    targetId: pageId,
    flatten: true,
  })
  return sessionId
}

async function sendToPage(ws, sessionId, method, params = {}) {
  const id = Math.floor(Math.random() * 100000)
  ws.send(JSON.stringify({ id, sessionId, method, params }))
  return new Promise((resolve, reject) => {
    const handler = (msg) => {
      const data = JSON.parse(msg.data)
      if (data.id === id) {
        ws.removeEventListener('message', handler)
        if (data.error) reject(new Error(data.error.message))
        else resolve(data.result)
      }
    }
    ws.addEventListener('message', handler)
  })
}

async function main() {
  const cmd = process.argv[2]
  if (!cmd) {
    console.log('Commands: pages, screenshot, dom, eval, console, snap')
    process.exit(1)
  }

  if (cmd === 'pages') {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`)
    const pages = await res.json()
    console.log(JSON.stringify(pages.map(p => ({
      id: p.id, title: p.title, url: p.url, ws: p.webSocketDebuggerUrl
    })), null, 2))
    return
  }

  const pageId = process.argv[3]
  if (!pageId && cmd !== 'pages') {
    console.error('Usage: node cdp.mjs <command> <pageId> [args...]')
    process.exit(1)
  }

  const ws = await connectBrowser()
  const sessionId = await connectPage(ws, pageId)

  switch (cmd) {
    case 'screenshot': {
      const result = await sendToPage(ws, sessionId, 'Page.captureScreenshot', { format: 'png' })
      await ws.close()
      const fs = await import('node:fs')
      const dir = new URL('screenshots', import.meta.url)
      fs.mkdirSync(dir, { recursive: true })
      const name = `electron-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
      fs.writeFileSync(new URL(name, import.meta.url), Buffer.from(result.data, 'base64'))
      console.log('Saved to scripts/screenshots/' + name)
      break
    }

    case 'dom': {
      await sendToPage(ws, sessionId, 'DOM.enable')
      const { root } = await sendToPage(ws, sessionId, 'DOM.getDocument', { depth: 3 })
      await ws.close()
      console.log(JSON.stringify(serializeNode(root), null, 2))
      break
    }

    case 'eval': {
      const expr = process.argv.slice(4).join(' ')
      if (!expr) { console.error('Need JS expression'); break }
      const result = await sendToPage(ws, sessionId, 'Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
      })
      await ws.close()
      console.log(JSON.stringify(result, null, 2))
      break
    }

    case 'console': {
      // Enable console
      await sendToPage(ws, sessionId, 'Console.enable')
      const messages = []
      ws.addEventListener('message', (msg) => {
        const data = JSON.parse(msg.data)
        if (data.method === 'Console.messageAdded') {
          messages.push(data.params.message)
        }
      })
      // Wait a moment for queued messages
      await new Promise(r => setTimeout(r, 500))
      await ws.close()
      console.log(JSON.stringify(messages, null, 2))
      break
    }

    case 'snap': {
      // Get accessibility tree
      await sendToPage(ws, sessionId, 'Accessibility.enable')
      const { tree } = await sendToPage(ws, sessionId, 'Accessibility.getFullAXTree')
      await ws.close()
      // Simplify to a readable tree
      function flattenTree(node, depth = 0) {
        const role = node.role?.value || 'unknown'
        const name = node.name?.value || ''
        const indent = '  '.repeat(depth)
        let result = `${indent}[${role}] ${name}`
        if (node.children) {
          for (const child of node.children) {
            result += '\n' + flattenTree(child, depth + 1)
          }
        }
        return result
      }
      const flat = flattenTree(tree)
      console.log(flat)
      break
    }

    default:
      console.error('Unknown command:', cmd)
  }
}

function serializeNode(node, depth = 0) {
  const indent = '  '.repeat(depth)
  let result = `${indent}<${node.nodeName}`
  if (node.attributes) {
    for (let i = 0; i < node.attributes.length; i += 2) {
      result += ` ${node.attributes[i]}="${node.attributes[i + 1]}"`
    }
  }
  result += '>'
  if (node.nodeValue) {
    result += node.nodeValue.trim()
  }
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      result += '\n' + serializeNode(child, depth + 1)
    }
    result += `\n${indent}</${node.nodeName}>`
  } else if (!isVoidElement(node.nodeName)) {
    result += `</${node.nodeName}>`
  }
  return result
}

function isVoidElement(tag) {
  return ['BR', 'HR', 'IMG', 'INPUT', 'META', 'LINK', 'AREA', 'BASE', 'COL', 'EMBED', 'SOURCE', 'TRACK', 'WBR'].includes(tag)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
