// ── AI Model Configuration ──

export interface AiModel {
  id: string
  name: string
  provider: 'anthropic' | 'openai-compatible'
  modelId: string
  apiKey: string
  /** Custom API base URL for OpenAI-compatible providers */
  baseUrl: string
  temperature: number
  maxTokens: number
}

// ── Chat Message ──

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// ── Chat Session ──

export interface ChatSession {
  id: string
  name: string
  created_at: string
  updated_at: string
}

// ── MCP Service ──

export interface McpService {
  id: string
  name: string
  type: 'stdio' | 'sse'
  command: string
  args: string[]
  url: string
  env: Record<string, string>
  enabled: boolean
  created_at: string
}

// ── Skill Item ──

export interface SkillItem {
  id: string
  name: string
  description: string
  content?: string
  builtin?: boolean
  enabled: boolean
  created_at: string
}

// ── Chat Capabilities (工具/技能/搜索等在会话中的激活状态) ──

export interface ChatCapabilities {
  /** 用户选中的 Skill ID 列表，其 content 会注入到 system prompt */
  activeSkillIds: string[]
  /** 用户选中的 MCP Service ID 列表（预留） */
  activeMcpServiceIds: string[]
  /** 是否启用 Web Search */
  webSearch: boolean
}

// ── File Attachment ──

export interface FileAttachment {
  name: string
  path: string
  content: string
  size: number
}
