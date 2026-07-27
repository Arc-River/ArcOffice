import { ref } from 'vue'
import type { AiModel, ChatCapabilities, ChatMessage, ChatSession, FileAttachment } from '@/types/ai'
import { getElectronAPI } from '@/utils/ipc'

export function useAiChat() {
  const api = getElectronAPI()
  const messages = ref<ChatMessage[]>([])
  const sessions = ref<ChatSession[]>([])
  const isStreaming = ref(false)
  const currentStreamId = ref<string | null>(null)
  const currentSessionId = ref<string | null>(null)

  let cleanups: (() => void)[] = []
  let currentSessionDirty = false

  function cleanup() {
    for (const fn of cleanups) {
      fn()
    }
    cleanups = []
  }

  /**
   * Get the active model configuration from the main process.
   */
  async function getActiveModel(): Promise<AiModel | null> {
    if (!api) return null
    try {
      const modelId = await api.getActiveModel()
      if (!modelId) return null
      const models = await api.getAiModels()
      return models.find((m) => m.id === modelId) || null
    } catch {
      return null
    }
  }

  // ── Session Persistence ──

  /**
   * Load all sessions from DB.
   */
  async function loadSessions(): Promise<void> {
    if (!api) return
    try {
      sessions.value = await api.listSessions()
    } catch {
      // DB not available
    }
  }

  /**
   * Create a new session, add it to the list, and switch to it.
   */
  async function createSession(name?: string): Promise<string | null> {
    if (!api) return null
    try {
      const sessionName = name || '新对话'
      const session = await api.createSession(sessionName)
      sessions.value.unshift(session)
      await switchSession(session.id)
      return session.id
    } catch {
      return null
    }
  }

  /**
   * Delete a session and remove it from the list.
   */
  async function deleteSession(id: string): Promise<void> {
    if (!api) return
    try {
      await api.deleteSession(id)
      sessions.value = sessions.value.filter((s) => s.id !== id)
      if (currentSessionId.value === id) {
        await switchSession(null)
      }
    } catch {
      // ignore
    }
  }

  /**
   * Rename a session.
   */
  async function renameSession(id: string, name: string): Promise<void> {
    if (!api) return
    try {
      await api.renameSession(id, name)
      const session = sessions.value.find((s) => s.id === id)
      if (session) {
        session.name = name
      }
    } catch {
      // ignore
    }
  }

  /**
   * Save current session messages to DB.
   */
  async function saveCurrentSession(): Promise<void> {
    const sid = currentSessionId.value
    if (!sid || !api || !currentSessionDirty) return
    try {
      await api.saveMessages(sid, JSON.parse(JSON.stringify(messages.value)))
      currentSessionDirty = false
    } catch {
      // ignore
    }
  }

  /**
   * Switch to a different session: save current, load target.
   */
  async function switchSession(id: string | null): Promise<void> {
    if (id === currentSessionId.value) return
    // 流式传输中不允许切换会话，防止数据丢失
    if (isStreaming.value) return

    // Save current session before switching
    await saveCurrentSession()

    currentSessionId.value = id

    if (!id || !api) {
      messages.value = []
      return
    }

    try {
      const msgs = await api.getMessages(id)
      messages.value = msgs.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }))
      currentSessionDirty = false
    } catch {
      messages.value = []
    }
  }

  // ── Send Message ──

  async function sendMessage(text: string, capabilities?: ChatCapabilities, attachments?: FileAttachment[]) {
    const textContent = text.trim()
    const hasText = textContent.length > 0
    const hasFiles = attachments !== undefined && attachments.length > 0
    if (!hasText && !hasFiles) return
    if (isStreaming.value) return

    // Check if Electron API is available
    if (!api) {
      messages.value.push({
        role: 'assistant',
        content: 'Electron API 不可用，请在 Electron 环境中运行该应用。',
      })
      return
    }

    // Auto-create session if none active
    if (!currentSessionId.value) {
      // Derive name from text or first attachment name
      const sessionName = hasText
        ? textContent.length > 20
          ? `${textContent.slice(0, 20)}…`
          : textContent
        : attachments?.[0]?.name || '文件分析'
      const created = await createSession(sessionName)
      if (!created) {
        messages.value.push({
          role: 'assistant',
          content: '创建会话失败，请重试。',
        })
        return
      }
    }

    const model = await getActiveModel()
    if (!model) {
      messages.value.push({
        role: 'assistant',
        content: '请先在设置中添加并激活一个 AI 模型。',
      })
      return
    }

    // Build user message: user prompt + optional file references
    let userContent = textContent
    if (hasFiles) {
      const fileList = (attachments as FileAttachment[]).map((f) => {
        const sizeKB = (f.size / 1024).toFixed(1)
        return `- **${f.name}** (\`${f.path}\`) -- ${sizeKB} KB`
      })
      userContent = [textContent, '', '---', '## 已附文件', '', ...fileList].join('\n')
    }
    messages.value.push({ role: 'user', content: userContent })
    currentSessionDirty = true

    // Add placeholder assistant message
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' }
    messages.value.push(assistantMsg)
    const assistantIndex = messages.value.length - 1

    isStreaming.value = true

    try {
      // Register stream listeners
      const removeChunk = api.onStreamChunk((data) => {
        messages.value[assistantIndex] = {
          ...messages.value[assistantIndex],
          content: messages.value[assistantIndex].content + data.text,
        }
      })

      const finishStream = () => {
        isStreaming.value = false
        currentStreamId.value = null
        cleanup()
        // Save messages after stream completes
        saveCurrentSession()
      }

      const removeDone = api.onStreamDone(() => {
        finishStream()
      })

      const removeError = api.onStreamError((data) => {
        messages.value[assistantIndex] = {
          ...messages.value[assistantIndex],
          content: messages.value[assistantIndex].content || `请求失败: ${data.error}`,
        }
        finishStream()
      })

      cleanups = [removeChunk, removeDone, removeError]

      // Deep-clone via JSON to strip Vue reactivity proxies (structuredClone throws on Proxy objects)
      const chatParams = JSON.parse(
        JSON.stringify({
          model,
          messages: messages.value.slice(0, -1),
          capabilities,
        }),
      ) as { model: AiModel; messages: ChatMessage[]; capabilities?: ChatCapabilities }

      // Start the stream — returns immediately, stream runs in background
      const result = await api.chatStream(chatParams)
      currentStreamId.value = result.id
    } catch (err) {
      isStreaming.value = false
      cleanup()
      const message = err instanceof Error ? err.message : String(err)
      messages.value[assistantIndex] = {
        ...messages.value[assistantIndex],
        content: `请求失败: ${message}`,
      }
    }
  }

  /**
   * Abort the current stream.
   */
  function abortStream() {
    currentStreamId.value = null
    isStreaming.value = false
    cleanup()
  }

  /**
   * Clear messages for the current session.
   */
  function clearMessages() {
    abortStream()
    messages.value = []
    currentSessionDirty = true
  }

  return {
    messages,
    sessions,
    isStreaming,
    currentSessionId,
    sendMessage,
    abortStream,
    clearMessages,
    loadSessions,
    createSession,
    deleteSession,
    renameSession,
    switchSession,
    saveCurrentSession,
  }
}
