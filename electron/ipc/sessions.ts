import { getDb, persistDb, queryRow } from './db'

interface SessionRow {
  id: string
  name: string
  created_at: string
  updated_at: string
}

/**
 * List all chat sessions, ordered by most recently updated.
 */
export async function listSessions(): Promise<SessionRow[]> {
  const d = await getDb()
  const stmt = d.prepare(
    'SELECT id, name, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC',
  )
  const results: SessionRow[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as SessionRow)
  }
  stmt.free()
  return results
}

/**
 * Create a new chat session.
 */
export async function createSession(
  _event: Electron.IpcMainInvokeEvent,
  name: string,
): Promise<SessionRow> {
  const d = await getDb()
  const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  d.run(
    'INSERT INTO chat_sessions (id, name) VALUES ($id, $name)',
    { $id: id, $name: name },
  )
  persistDb()

  const row = queryRow('SELECT id, name, created_at, updated_at FROM chat_sessions WHERE id = $id', { $id: id })
  return row as unknown as SessionRow
}

/**
 * Rename a session.
 */
export async function renameSession(
  _event: Electron.IpcMainInvokeEvent,
  id: string,
  name: string,
): Promise<void> {
  const d = await getDb()
  d.run(
    'UPDATE chat_sessions SET name = $name, updated_at = CURRENT_TIMESTAMP WHERE id = $id',
    { $id: id, $name: name },
  )
  persistDb()
}

/**
 * Delete a session and all its messages (CASCADE).
 */
export async function deleteSession(
  _event: Electron.IpcMainInvokeEvent,
  id: string,
): Promise<void> {
  const d = await getDb()
  // Manually delete messages first (sql.js doesn't support ON DELETE CASCADE with foreign keys unless PRAGMA foreign_keys = ON)
  d.run('DELETE FROM chat_messages WHERE session_id = $id', { $id: id })
  d.run('DELETE FROM chat_sessions WHERE id = $id', { $id: id })
  persistDb()
}

/**
 * Get all messages for a session, ordered by creation time.
 */
export async function getMessages(
  _event: Electron.IpcMainInvokeEvent,
  sessionId: string,
): Promise<{ role: string; content: string }[]> {
  const d = await getDb()
  const stmt = d.prepare(
    'SELECT role, content FROM chat_messages WHERE session_id = $sessionId ORDER BY created_at ASC',
  )
  stmt.bind({ $sessionId: sessionId })
  const results: { role: string; content: string }[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as { role: string; content: string }
    results.push(row)
  }
  stmt.free()
  return results
}

/**
 * Save messages for a session (idempotent: replaces all existing messages).
 * Wrapped in a transaction for efficiency.
 */
export async function saveMessages(
  _event: Electron.IpcMainInvokeEvent,
  sessionId: string,
  messages: { role: string; content: string }[],
): Promise<void> {
  const d = await getDb()
  d.run('BEGIN TRANSACTION')
  try {
    d.run('DELETE FROM chat_messages WHERE session_id = $id', { $id: sessionId })
    for (const msg of messages) {
      d.run(
        'INSERT INTO chat_messages (session_id, role, content) VALUES ($sid, $role, $content)',
        { $sid: sessionId, $role: msg.role, $content: msg.content },
      )
    }
    d.run(
      'UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $id',
      { $id: sessionId },
    )
    d.run('COMMIT')
  } catch (err) {
    d.run('ROLLBACK')
    throw err
  }
  persistDb()
}
