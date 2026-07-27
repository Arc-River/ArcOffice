import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  listDirectory: (dirPath: string) => ipcRenderer.invoke('io:listDirectory', dirPath),
  readFileText: (filePath: string) => ipcRenderer.invoke('io:readFileText', filePath),
  readFileBinary: (filePath: string) => ipcRenderer.invoke('io:readFileBinary', filePath),
  writeFileBinary: (filePath: string, data: number[]) => ipcRenderer.invoke('io:writeFileBinary', filePath, data),
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  openOfficeFileDialog: () => ipcRenderer.invoke('dialog:openOfficeFile'),
  saveOfficeFileDialog: (defaultName: string) => ipcRenderer.invoke('dialog:saveOfficeFile', defaultName),

  // Database
  getConfig: (key: string) => ipcRenderer.invoke('db:getConfig', key),
  setConfig: (key: string, value: string) => ipcRenderer.invoke('db:setConfig', key, value),
  getFileHistory: () => ipcRenderer.invoke('db:getFileHistory'),
  addFileHistory: (file: Record<string, unknown>) => ipcRenderer.invoke('db:addFileHistory', file),
  createTask: (task: Record<string, unknown>) => ipcRenderer.invoke('db:createTask', task),
  updateTaskProgress: (id: number, progress: number, status: string) =>
    ipcRenderer.invoke('db:updateTaskProgress', id, progress, status),
  getTasks: () => ipcRenderer.invoke('db:getTasks'),

  // AI - Chat
  chatStream: (params: unknown) => ipcRenderer.invoke('ai:chat', params),
  onStreamChunk: (callback: (data: { id: string; text: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string; text: string }) =>
      callback(data)
    ipcRenderer.on('ai:stream-chunk', handler)
    // Return cleanup function
    return () => ipcRenderer.removeListener('ai:stream-chunk', handler)
  },
  onStreamDone: (callback: (data: { id: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string }) => callback(data)
    ipcRenderer.on('ai:stream-done', handler)
    return () => ipcRenderer.removeListener('ai:stream-done', handler)
  },
  onStreamError: (callback: (data: { id: string; error: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { id: string; error: string }) =>
      callback(data)
    ipcRenderer.on('ai:stream-error', handler)
    return () => ipcRenderer.removeListener('ai:stream-error', handler)
  },
  removeStreamListeners: () => {
    ipcRenderer.removeAllListeners('ai:stream-chunk')
    ipcRenderer.removeAllListeners('ai:stream-done')
    ipcRenderer.removeAllListeners('ai:stream-error')
  },
  // AI - Model storage
  getAiModels: () => ipcRenderer.invoke('db:getAiModels'),
  saveAiModels: (models: unknown) => ipcRenderer.invoke('db:saveAiModels', models),
  getActiveModel: () => ipcRenderer.invoke('db:getActiveModel'),
  setActiveModel: (modelId: string) => ipcRenderer.invoke('db:setActiveModel', modelId),
  testConnection: (model: unknown) => ipcRenderer.invoke('ai:testConnection', model),

  // Sessions
  listSessions: () => ipcRenderer.invoke('sessions:listSessions'),
  createSession: (name: string) => ipcRenderer.invoke('sessions:createSession', name),
  renameSession: (id: string, name: string) => ipcRenderer.invoke('sessions:renameSession', id, name),
  deleteSession: (id: string) => ipcRenderer.invoke('sessions:deleteSession', id),
  getMessages: (sessionId: string) => ipcRenderer.invoke('sessions:getMessages', sessionId),
  saveMessages: (sessionId: string, messages: unknown) => ipcRenderer.invoke('sessions:saveMessages', sessionId, messages),

  // Skills
  getSkills: () => ipcRenderer.invoke('db:getSkills'),
  saveSkills: (skills: unknown) => ipcRenderer.invoke('db:saveSkills', skills),

  // MCP services
  getMcpServices: () => ipcRenderer.invoke('db:getMcpServices'),
  saveMcpServices: (services: unknown) => ipcRenderer.invoke('db:saveMcpServices', services),
})
