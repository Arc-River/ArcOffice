import type {
  AiModel,
  ChatCapabilities,
  ChatMessage,
  ChatSession,
  McpService,
  SkillFileEntry,
  SkillItem,
} from '@/types/ai'
import { IpcError } from '@/types/ipc'
import type { FileRecord, TaskCreate, TaskRecord } from '@/types/models'

/**
 * Electron IPC wrapper.
 * All frontend IPC calls MUST go through this function.
 * Communicates with the main process via window.electronAPI (contextBridge).
 */

// Extend the Window interface with electronAPI from preload
declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>
      checkUpdate: () => Promise<{ latestVersion: string; releaseUrl: string }>
      openDirectory: (dirPath: string) => Promise<void>
      listDirectory: (dirPath: string) => Promise<{ name: string; isDir: boolean; size: number; mtime: string }[]>
      readFileText: (filePath: string) => Promise<string>
      getConfig: (key: string) => Promise<string>
      setConfig: (key: string, value: string) => Promise<void>
      chatCompletion: (messages: unknown[]) => Promise<string>
      openFileDialog: () => Promise<string | null>
      selectDirectory: () => Promise<string | null>
      readFileBinary: (filePath: string) => Promise<{ data: number[]; path: string }>
      writeFileBinary: (filePath: string, data: number[]) => Promise<{ path: string }>
      openOfficeFileDialog: () => Promise<string | null>
      saveOfficeFileDialog: (defaultName: string) => Promise<string | null>
      getFileHistory: () => Promise<FileRecord[]>
      addFileHistory: (file: FileRecord) => Promise<void>
      createTask: (task: TaskCreate) => Promise<TaskRecord>
      updateTaskProgress: (id: number, progress: number, status: string) => Promise<void>
      getTasks: () => Promise<TaskRecord[]>
      // Phase 2 AI additions
      chatStream: (params: {
        model: AiModel
        messages: ChatMessage[]
        capabilities?: ChatCapabilities
      }) => Promise<{ id: string }>
      onStreamChunk: (callback: (data: { id: string; text: string }) => void) => () => void
      onStreamDone: (callback: (data: { id: string }) => void) => () => void
      onStreamError: (callback: (data: { id: string; error: string }) => void) => () => void
      removeStreamListeners: () => void
      // AI Model storage
      getAiModels: () => Promise<AiModel[]>
      saveAiModels: (models: AiModel[]) => Promise<void>
      getActiveModel: () => Promise<string>
      setActiveModel: (modelId: string) => Promise<void>
      testConnection: (model: AiModel) => Promise<{ success: boolean; message: string }>
      generateTitle: (model: AiModel, firstMessage: string, firstResponse: string) => Promise<string>
      // Sessions
      listSessions: () => Promise<ChatSession[]>
      createSession: (name: string) => Promise<ChatSession>
      renameSession: (id: string, name: string) => Promise<void>
      deleteSession: (id: string) => Promise<void>
      getMessages: (sessionId: string) => Promise<{ role: string; content: string }[]>
      saveMessages: (sessionId: string, messages: { role: string; content: string }[]) => Promise<void>
      // Skills — file-system-based
      getSkills: () => Promise<SkillItem[]>
      getSkillsDirPath: () => Promise<string>
      getSkillDetail: (name: string) => Promise<{ skill: SkillItem | null; files: SkillFileEntry[] }>
      saveSkill: (data: { name: string; description: string; content: string }) => Promise<void>
      deleteSkill: (name: string) => Promise<void>
      toggleSkill: (name: string, enabled: boolean) => Promise<void>
      getSkillFiles: (name: string) => Promise<SkillFileEntry[]>
      readSkillFile: (name: string, relativePath: string) => Promise<string>
      writeSkillFile: (name: string, relativePath: string, content: string) => Promise<void>
      deleteSkillFile: (name: string, relativePath: string) => Promise<void>
      // MCP services
      getMcpServices: () => Promise<McpService[]>
      saveMcpServices: (services: McpService[]) => Promise<void>
    }
  }
}

type ElectronApiMethod = keyof Window['electronAPI']

/**
 * Check if running inside Electron with contextBridge available.
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

/**
 * Safe accessor for the electronAPI.
 * Returns null when not running in Electron (e.g. browser-only dev mode).
 */
export function getElectronAPI(): Window['electronAPI'] | null {
  return window.electronAPI || null
}

/**
 * Invoke an Electron IPC method exposed via contextBridge.
 * Wraps the response in the standard RpcResponse pattern for backward compatibility.
 */
export async function invokeIpc<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const api = window.electronAPI
    if (!api) {
      throw new IpcError(5001, 'electronAPI not available (not running in Electron?)')
    }

    const methodName = cmd as ElectronApiMethod
    const method = api[methodName]
    if (!method) {
      throw new IpcError(5001, `Unknown IPC method: ${cmd}`)
    }

    // Pass the first argument if present
    const fn = method as (...params: unknown[]) => unknown
    const result = args ? await fn(args) : await fn()

    return result as T
  } catch (err) {
    if (err instanceof IpcError) throw err
    throw new IpcError(5001, String(err))
  }
}
