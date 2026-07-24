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
  enabled: boolean
  created_at: string
}

// ── Prompt Template ──

export interface PromptTemplate {
  id: string
  name: string
  content: string
  created_at: string
}
