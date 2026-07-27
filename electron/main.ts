import { app, BrowserWindow, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { open } from 'node:inspector'
import { registerAllHandlers } from './ipc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 开发模式下启用 Node.js inspector，方便 chrome://inspect 调试主进程
if (!app.isPackaged) {
  try {
    open(9229, '0.0.0.0', false)
    console.log('[debug] Inspector listening on ws://0.0.0.0:9229')
  } catch {
    // inspector already open or not available
  }
}

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 500,
    title: 'ArcOffice',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Set Content-Security-Policy only in production to avoid
  // breaking Vite HMR in development
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'",
          ],
        },
      })
    })
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST!, 'index.html'))
  }
  // 开发模式下按需打开 DevTools（⌘⌥I），或通过 chrome://inspect 调试主进程
}

app.on('ready', () => {
  registerAllHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
