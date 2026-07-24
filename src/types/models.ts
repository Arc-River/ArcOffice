// ── Data models shared between frontend and IPC ──

export interface FileRecord {
  id?: number
  path: string
  name: string
  type: string
  opened_at?: string
  tags?: string
}

export interface TaskCreate {
  type: string
  status?: string
  progress?: number
  log?: string
}

export interface TaskRecord {
  id: number
  type: string
  status: string
  progress: number
  log: string | null
  created_at: string
}
