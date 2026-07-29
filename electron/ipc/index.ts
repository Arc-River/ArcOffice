import { dialog, ipcMain, type OpenDialogOptions, type SaveDialogOptions } from 'electron'
import * as app from './app'
import * as io from './io'
import * as db from './db'
import * as ai from './ai'
import * as sessions from './sessions'
import * as skills from './skills'

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

/** Shared helper for open-dialog IPC handlers */
async function openDialog(options: OpenDialogOptions): Promise<string | null> {
  const result = await dialog.showOpenDialog(options)
  return result.canceled ? null : result.filePaths[0]
}

/** Shared helper for save-dialog IPC handlers */
async function saveDialog(options: SaveDialogOptions): Promise<string | null> {
  const result = await dialog.showSaveDialog(options)
  return result.canceled ? null : result.filePath
}

export function registerAllHandlers() {
  // App info
  registerModule('app', app)

  // Auto-register by module prefix
  registerModule('io', io)

  // Sessions use their own prefix
  registerModule('sessions', sessions)

  // Skills — file-system-based skill management
  registerModule('skills', skills)

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
  ipcMain.handle('ai:generateTitle', ai.generateTitle)

  // File dialogs
  ipcMain.handle('dialog:openFile', () =>
    openDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Supported Files', extensions: ['docx', 'xlsx', 'pptx', 'txt', 'md', 'json', 'csv', 'js', 'ts', 'vue', 'css', 'scss', 'html', 'xml', 'yaml', 'yml', 'toml'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    }),
  )

  ipcMain.handle('dialog:selectDirectory', () =>
    openDialog({ properties: ['openDirectory'] }),
  )

  ipcMain.handle('dialog:openOfficeFile', () =>
    openDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Office Documents', extensions: ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'odt', 'ods', 'odp', 'csv', 'txt', 'rtf'] },
        { name: 'Word', extensions: ['docx', 'doc', 'odt', 'rtf'] },
        { name: 'Excel', extensions: ['xlsx', 'xls', 'ods', 'csv'] },
        { name: 'PowerPoint', extensions: ['pptx', 'ppt', 'odp'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    }),
  )

  ipcMain.handle('dialog:saveOfficeFile', (_event, defaultName: string) =>
    saveDialog({
      defaultPath: defaultName,
      filters: [
        { name: 'Office Documents', extensions: ['docx', 'xlsx', 'pptx'] },
        { name: 'Word', extensions: ['docx'] },
        { name: 'Excel', extensions: ['xlsx'] },
        { name: 'PowerPoint', extensions: ['pptx'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    }),
  )
}
