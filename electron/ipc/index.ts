import { dialog, ipcMain } from 'electron'
import * as io from './io'
import * as db from './db'
import * as ai from './ai'
import * as sessions from './sessions'

/**
 * Auto-register all function exports from a module under a given IPC prefix.
 * e.g. registerModule('db', db) registers db:getConfig, db:setConfig, etc.
 */
function registerModule(prefix: string, mod: Record<string, unknown>) {
  for (const [name, handler] of Object.entries(mod)) {
    if (typeof handler === 'function') {
      ipcMain.handle(`${prefix}:${name}`, handler)
    }
  }
}

export function registerAllHandlers() {
  // Auto-register by module prefix
  registerModule('io', io)

  // Sessions use their own prefix
  registerModule('sessions', sessions)

  // Database — skip internal helpers (queryRow, queryAll) that aren't IPC handlers
  // and only register public-facing handlers
  const dbPublic = Object.fromEntries(
    Object.entries(db).filter(([name]) =>
      !['getDb', 'persistDb', 'queryRow', 'queryAll'].includes(name),
    ),
  )
  registerModule('db', dbPublic)

  // AI — manual registration because channel names differ from function names
  // (ai:chat → chatStream, ai:testConnection → testConnection)
  ipcMain.handle('ai:chat', ai.chatStream)
  ipcMain.handle('ai:testConnection', ai.testConnection)

  // File dialog (inline handlers, not in a module)
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Supported Files', extensions: ['docx', 'xlsx', 'pptx', 'txt', 'md', 'json', 'csv', 'js', 'ts', 'vue', 'css', 'scss', 'html', 'xml', 'yaml', 'yml', 'toml'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
