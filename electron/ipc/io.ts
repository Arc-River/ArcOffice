import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { isPathAllowed } from './path-utils'

export async function listDirectory(_event: Electron.IpcMainInvokeEvent, dirPath: string) {
  if (!isPathAllowed(dirPath)) {
    throw new Error(`Permission denied: ${dirPath}`)
  }

  const entries = await fsp.readdir(dirPath, { withFileTypes: true })
  return entries.map((entry) => ({
    name: entry.name,
    isDir: entry.isDirectory(),
    size: entry.isFile() ? fs.statSync(path.join(dirPath, entry.name)).size : 0,
    mtime: (entry.isFile() || entry.isDirectory())
      ? fs.statSync(path.join(dirPath, entry.name)).mtime.toISOString()
      : '',
  }))
}

export async function readFileText(_event: Electron.IpcMainInvokeEvent, filePath: string) {
  if (!isPathAllowed(filePath)) {
    throw new Error(`Permission denied: ${filePath}`)
  }
  return await fsp.readFile(filePath, 'utf-8')
}

// ── Binary file I/O (needed by OnlyOffice) ──

export async function readFileBinary(_event: Electron.IpcMainInvokeEvent, filePath: string) {
  if (!isPathAllowed(filePath)) {
    throw new Error(`Permission denied: ${filePath}`)
  }
  const buffer = await fsp.readFile(filePath)
  return { data: [...buffer], path: filePath }
}

export async function writeFileBinary(
  _event: Electron.IpcMainInvokeEvent,
  filePath: string,
  data: number[],
) {
  if (!isPathAllowed(filePath)) {
    throw new Error(`Permission denied: ${filePath}`)
  }
  await fsp.writeFile(filePath, Buffer.from(data))
  return { path: filePath }
}
