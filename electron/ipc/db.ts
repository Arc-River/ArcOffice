import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'

const _require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

let SQL: SqlJsStatic | null = null
let db: Database | null = null
let dbPath = ''

export async function getDb(): Promise<Database> {
  if (db) return db

  // Initialize sql.js once — load WASM from source to avoid bundling issues
  if (!SQL) {
    const wasmPath = _require.resolve('sql.js/dist/sql-wasm.wasm')
    const wasmBinary = fs.readFileSync(wasmPath)
    SQL = await initSqlJs({ wasmBinary })
  }

  dbPath = path.join(app.getPath('userData'), 'arcoffice.db')
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  // Performance settings
  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA synchronous = NORMAL')

  // Initialize core tables
  db.run(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS file_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tags TEXT
    );
    CREATE TABLE IF NOT EXISTS task_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress REAL DEFAULT 0,
      log TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );
  `)

  // Save initial schema to disk
  persistDb()

  return db
}

/**
 * Persist in-memory database to disk.
 * Call after every write operation.
 */
export function persistDb() {
  if (!db || !dbPath) return
  const data = db.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
}

/**
 * Helper: execute a query and return first row as a plain object.
 */
export function queryRow(sql: string, params?: Record<string, unknown>): Record<string, unknown> | null {
  if (!db) return null
  const stmt = db.prepare(sql)
  if (params) stmt.bind(params)
  if (stmt.step()) {
    const result = stmt.getAsObject()
    stmt.free()
    return result as Record<string, unknown>
  }
  stmt.free()
  return null
}

/**
 * Helper: execute a query and return all rows as plain objects.
 */
export function queryAll(sql: string, params?: Record<string, unknown>): Record<string, unknown>[] {
  if (!db) return []
  const stmt = db.prepare(sql)
  if (params) stmt.bind(params)
  const results: Record<string, unknown>[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Record<string, unknown>)
  }
  stmt.free()
  return results
}

// ── Generic JSON Config Storage ──

async function getJsonConfig(key: string): Promise<unknown[]> {
  await getDb()
  const row = queryRow('SELECT value FROM app_config WHERE key = $key', { $key: key })
  if (!row?.value) return []
  try {
    return JSON.parse(row.value as string)
  } catch {
    return []
  }
}

async function setJsonConfig(key: string, value: unknown): Promise<void> {
  const d = await getDb()
  d.run('INSERT OR REPLACE INTO app_config (key, value) VALUES ($key, $val)', {
    $key: key,
    $val: JSON.stringify(value),
  })
  persistDb()
}

/**
 * Parse simple YAML frontmatter from a Markdown file.
 * Returns { name, description, body }.
 */
// ── Specific Config Helpers (thin wrappers for type clarity) ──

export async function getMcpServices(_event?: Electron.IpcMainInvokeEvent) {
  return getJsonConfig('mcp_services')
}
export async function saveMcpServices(_event: Electron.IpcMainInvokeEvent, services: unknown[]) {
  return setJsonConfig('mcp_services', services)
}

export async function getAiModels(_event?: Electron.IpcMainInvokeEvent) {
  return getJsonConfig('ai_models')
}
export async function saveAiModels(_event: Electron.IpcMainInvokeEvent, models: unknown[]) {
  return setJsonConfig('ai_models', models)
}

// ── Active Model (plain string, not JSON) ──

export async function getActiveModel(_event: Electron.IpcMainInvokeEvent) {
  await getDb()
  const row = queryRow('SELECT value FROM app_config WHERE key = $key', { $key: 'active_model_id' })
  return (row?.value as string) ?? ''
}

export async function setActiveModel(
  _event: Electron.IpcMainInvokeEvent,
  modelId: string,
) {
  const d = await getDb()
  d.run('INSERT OR REPLACE INTO app_config (key, value) VALUES ($key, $val)', {
    $key: 'active_model_id',
    $val: modelId,
  })
  persistDb()
}

// ── Generic Config ──

export async function getConfig(_event: Electron.IpcMainInvokeEvent, key: string) {
  await getDb()
  const row = queryRow('SELECT value FROM app_config WHERE key = $key', { $key: key })
  return (row?.value as string) ?? ''
}

export async function setConfig(
  _event: Electron.IpcMainInvokeEvent,
  key: string,
  value: string,
) {
  const d = await getDb()
  d.run('INSERT OR REPLACE INTO app_config (key, value) VALUES ($key, $val)', {
    $key: key,
    $val: value,
  })
  persistDb()
}

// ── IPC Handlers: File History ──

export async function getFileHistory(_event: Electron.IpcMainInvokeEvent) {
  await getDb()
  return queryAll('SELECT id, path, name, type, opened_at, tags FROM file_history ORDER BY opened_at DESC LIMIT 50')
}

export async function addFileHistory(
  _event: Electron.IpcMainInvokeEvent,
  file: { path: string; name: string; type: string; tags?: string },
) {
  const d = await getDb()
  d.run(
    'INSERT INTO file_history (path, name, type, tags) VALUES ($path, $name, $type, $tags)',
    {
      $path: file.path,
      $name: file.name,
      $type: file.type,
      $tags: file.tags || null,
    },
  )
  persistDb()
}

// ── IPC Handlers: Tasks ──

export async function createTask(
  _event: Electron.IpcMainInvokeEvent,
  task: { type: string; status?: string; progress?: number; log?: string },
) {
  const d = await getDb()
  d.run(
    'INSERT INTO task_records (type, status, progress, log) VALUES ($type, $status, $progress, $log)',
    {
      $type: task.type,
      $status: task.status || 'pending',
      $progress: task.progress ?? 0,
      $log: task.log || null,
    },
  )
  persistDb()

  // Return the created task
  const row = queryRow('SELECT * FROM task_records ORDER BY id DESC LIMIT 1')
  return row
}

export async function updateTaskProgress(
  _event: Electron.IpcMainInvokeEvent,
  id: number,
  progress: number,
  status: string,
) {
  const d = await getDb()
  d.run(
    'UPDATE task_records SET progress = $progress, status = $status WHERE id = $id',
    { $id: id, $progress: progress, $status: status },
  )
  persistDb()
}

export async function getTasks(_event: Electron.IpcMainInvokeEvent) {
  await getDb()
  return queryAll('SELECT * FROM task_records ORDER BY created_at DESC')
}
