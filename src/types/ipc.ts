// ── Standard IPC Response ──
// Matches Rust RpcResponse<T> serialization.
export interface RpcResponse<T = unknown> {
  code: number
  data?: T
  message: string
}

// ── Error Codes ──
export enum ErrorCode {
  Success = 0,
  // IO (1xxx)
  FileNotFound = 1001,
  FilePermission = 1002,
  // Format (2xxx)
  UnsupportedFormat = 2001,
  FileCorrupted = 2002,
  // AI (3xxx)
  AiTimeout = 3001,
  AiContextOverflow = 3002,
  // Permission (4xxx)
  PathUnauthorized = 4001,
  KeyNotConfigured = 4002,
  // System (5xxx)
  ProcessCrash = 5001,
  OutOfMemory = 5002,
}

// ── IPC Error ──
export class IpcError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(`IPC Error [${code}]: ${message}`)
    this.name = 'IpcError'
  }
}
