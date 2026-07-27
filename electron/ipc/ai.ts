import Anthropic from '@anthropic-ai/sdk'
import type AnthropicT from '@anthropic-ai/sdk'
import { exec as execCallback } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { app } from 'electron'
import { getDb, getSkills, getMcpServices, queryRow } from './db'
import { isPathAllowed as checkPathAllowed } from './path-utils'
import { MCPManager, type MCPServiceConfig, type MCPToolDefinition } from './mcp-client'

const exec = promisify(execCallback)

// ── Types ──

type Provider = 'anthropic' | 'openai-compatible'

interface AiModel {
  id: string
  provider: Provider
  modelId: string
  apiKey: string
  baseUrl: string
  temperature: number
  maxTokens: number
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatCapabilities {
  activeSkillIds: string[]
  activeMcpServiceIds: string[]
  webSearch: boolean
}

interface SkillItem {
  id: string
  name: string
  description: string
  content?: string
  builtin?: boolean
  enabled: boolean
  created_at: string
}

interface ChatParams {
  model: AiModel
  messages: ChatMessage[]
  capabilities?: ChatCapabilities
}

// ── Path Safety ──

let cachedWorkingDir: string | null = null

async function loadWorkingDir(): Promise<string | null> {
  try {
    const d = await getDb()
    const stmt = d.prepare('SELECT value FROM app_config WHERE key = $key')
    stmt.bind({ $key: 'working_dir' })
    if (stmt.step()) {
      const row = stmt.getAsObject() as { value: string }
      stmt.free()
      if (row.value) {
        const resolved = path.resolve(row.value)
        if (fs.existsSync(resolved)) {
          cachedWorkingDir = resolved
          return resolved
        }
      }
    }
    stmt.free()
  } catch {
    // DB not available
  }
  return null
}

function isPathAllowed(targetPath: string): boolean {
  return checkPathAllowed(targetPath, cachedWorkingDir)
}

// ── File Operation Tools ──

const FILE_TOOLS = [
  {
    name: 'read_file',
    description: '读取指定文件的文本内容（UTF-8）。用于查看源代码、配置、JSON、Markdown 等纯文本文件。',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件的绝对路径' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: '将文本内容写入指定文件（覆盖写入）。如果文件不存在则创建新文件。用于创建新文件或完全重写现有文件。注意：只能写入纯文本格式，不能生成 .docx/.xlsx/.pptx 等二进制格式。',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件的绝对路径' },
        content: { type: 'string', description: '要写入的完整文件内容' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: '对文本文件进行精确的查找替换编辑。查找的 old_string 必须与文件中现有内容完全匹配（包括缩进和空格），只替换第一个匹配项。用于对文本文件进行局部修改。不支持二进制格式文件。',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件的绝对路径' },
        old_string: { type: 'string', description: '被替换的原文（必须与文件中内容完全一致）' },
        new_string: { type: 'string', description: '替换后的新文本' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'list_directory',
    description: '列出指定目录下的所有文件和文件夹。用于浏览项目结构、查找文件。',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目录的绝对路径' },
      },
      required: ['path'],
    },
  },
  {
    name: 'run_command',
    description: '在用户电脑上执行 shell 命令（非交互式）。用于运行构建命令、安装依赖、启动服务、执行脚本、查看文件等。命令在工作目录下执行。注意：不能运行交互式命令（如 vim、top）。',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的 shell 命令' },
      },
      required: ['command'],
    },
  },
]

const MAX_TOOL_ROUNDS = 30

/**
 * Execute a file operation tool and return its result.
 */
async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  // web_search and run_command don't have a path — handle before path resolution
  if (name === 'web_search') {
    return executeWebSearch(input)
  }
  if (name === 'run_command') {
    return executeRunCommand(input)
  }

  const targetPath = path.resolve(String(input.path))

  if (!isPathAllowed(targetPath)) {
    throw new Error(`权限不足：不允许访问路径 ${targetPath}`)
  }

  switch (name) {
    case 'read_file': {
      const content = await fsp.readFile(targetPath, 'utf-8')
      const stat = await fsp.stat(targetPath)
      return { content, size: stat.size, name: path.basename(targetPath) }
    }

    case 'write_file': {
      const dir = path.dirname(targetPath)
      if (!fs.existsSync(dir)) {
        await fsp.mkdir(dir, { recursive: true })
      }
      await fsp.writeFile(targetPath, String(input.content), 'utf-8')
      return { success: true, path: targetPath }
    }

    case 'edit_file': {
      const oldStr = String(input.old_string)
      const newStr = String(input.new_string)
      const content = await fsp.readFile(targetPath, 'utf-8')
      if (!content.includes(oldStr)) {
        // Try to give a helpful error message
        const lines = content.split('\n')
        const searchLines = oldStr.split('\n')
        const firstLine = searchLines[0].trim()
        const matchLine = lines.findIndex((l) => l.trim().includes(firstLine))
        let hint = `在文件中未找到精确匹配的文本。`
        if (matchLine >= 0) {
          const context = lines.slice(Math.max(0, matchLine - 1), matchLine + 2).join('\n')
          hint += ` 在第 ${matchLine + 1} 行附近找到相似内容，但缩进或格式不完全一致。附近内容：\n${context}`
        }
        throw new Error(hint)
      }
      const newContent = content.replace(oldStr, newStr)
      await fsp.writeFile(targetPath, newContent, 'utf-8')
      return { success: true, path: targetPath }
    }

    case 'list_directory': {
      const entries = await fsp.readdir(targetPath, { withFileTypes: true })
      const items = entries.map((e) => ({
        name: e.name,
        is_dir: e.isDirectory(),
        size: e.isFile() ? (fs.statSync(path.join(targetPath, e.name)).size) : 0,
      }))
      items.sort((a, b) => {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      return { path: targetPath, items }
    }


    default:
      throw new Error(`未知工具: ${name}`)
  }
}

/**
 * Execute a web search via Tavily API.
 * Called externally from executeTool before path validation.
 */
async function executeWebSearch(input: Record<string, unknown>): Promise<unknown> {
  const query = String(input.query)
  const maxResults = Number(input.max_results) || 5
  const wsConfig = getWebSearchConfig()
  if (!wsConfig?.api_key) throw new Error('Web search 未配置，请在设置中配置 API Key')
  const apiKey = wsConfig.api_key

  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`Tavily API error ${resp.status}: ${body}`)
  }
  const data = (await resp.json()) as {
    results?: Array<{ title: string; url: string; content: string; score: number }>
  }
  return (data.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
    relevance: r.score,
  }))
}

}

/**
 * Execute a shell command on the user's machine.
 */
async function executeRunCommand(input: Record<string, unknown>): Promise<unknown> {
  const command = String(input.command)
  const cwd = cachedWorkingDir || app.getPath('documents')

  if (!isPathAllowed(cwd)) {
    throw new Error(`权限不足：工作目录 ${cwd} 不在允许范围内`)
  }

  const { stdout, stderr } = await exec(command, {
    cwd,
    timeout: 30_000,
    maxBuffer: 1024 * 1024, // 1MB
  })

  return {
    stdout: stdout || '',
    stderr: stderr || '',
    exit_code: 0,
    cwd,
  }
}

// ── Web Search Config Helper ──

/**
 * Read web_search_config from DB and parse it.
 * Returns null if not configured or on error.
 */
function getWebSearchConfig(): { api_key?: string } | null {
  try {
    const row = queryRow("SELECT value FROM app_config WHERE key = 'web_search_config'")
    if (row?.value) return JSON.parse(row.value as string)
  } catch { /* ignore */ }
  return null
}

// ── Dynamic System Prompt Builder ──

/**
 * Load skills from DB, filter by active IDs, and build an enriched system prompt.
 */
async function buildSystemPrompt(capabilities?: ChatCapabilities): Promise<string> {
  let skillsSection = ''

  if (capabilities?.activeSkillIds?.length) {
    try {
      const allSkills = await getSkills() as SkillItem[]
      const activeSkills = allSkills.filter(
        (s) => s.enabled && capabilities.activeSkillIds.includes(s.id),
      )

      if (activeSkills.length > 0) {
        const parts = activeSkills.map(
          (s) => `### ${s.name}\n${s.description ? `> ${s.description}\n` : ''}\n${s.content || ''}`,
        )
        skillsSection = [
          '',
          '# 🧰 已激活的技能指令',
          '系统为你开启了以下技能，请在使用相关功能时严格遵循对应的操作指南：',
          '',
          parts.join('\n\n---\n\n'),
          '',
        ].join('\n')
      }
    } catch {
      // DB not available — skip skills injection
    }
  }

  // MCP services section — show service details and note that tools auto-register
  let mcpSection = ''
  if (capabilities?.activeMcpServiceIds?.length) {
    try {
      const allServices = await getMcpServices() as MCPServiceConfig[]
      const activeServices = allServices.filter(
        (s) => s.enabled && capabilities.activeMcpServiceIds.includes(s.id),
      )

      if (activeServices.length > 0) {
        const details = activeServices.map((s) => {
          if (s.type === 'stdio') {
            return `  - **${s.name}** (本地): \`${s.command} ${s.args.join(' ')}\``
          }
          return `  - **${s.name}** (远程): ${s.url}`
        })

        mcpSection = [
          '',
          '# 🔌 外部工具（MCP 服务）',
          '以下 MCP 服务已激活，它们的工具已自动注册到你的可用工具列表中，你可以直接调用它们（使用 `mcp__服务名__工具名` 命名格式）。每个工具在调用时会自动连接并执行。',
          '',
          '已激活的服务：',
          ...details,
          '',
        ].join('\n')
      }
    } catch {
      // DB not available — skip MCP section
    }
  }

  let webSearchSection = ''
  let hasWebSearchKey = false

  if (capabilities?.webSearch) {
    const config = getWebSearchConfig()
    hasWebSearchKey = !!config?.api_key

    if (hasWebSearchKey) {
      webSearchSection = [
        '',
        '# 🌐 Web 搜索',
        'Web 搜索功能已启用。你可以通过 web_search 工具搜索互联网获取最新信息。',
        '',
      ].join('\n')
    } else {
      webSearchSection = [
        '',
        '# 🌐 Web 搜索',
        '⚠️ Web 搜索已开启但未配置 API Key，请在设置中配置 Tavily API Key 以启用搜索功能。',
        '',
      ].join('\n')
    }
  }

  return SYSTEM_PROMPT_BASE + skillsSection + mcpSection + webSearchSection
}

/**
 * Build additional tool definitions based on capabilities and configuration.
 * Currently supports web_search tool when enabled and configured.
 */
async function buildDynamicTools(capabilities?: ChatCapabilities): Promise<typeof FILE_TOOLS> {
  const extraTools: typeof FILE_TOOLS = []

  if (capabilities?.webSearch) {
    const config = getWebSearchConfig()
    if (config?.api_key) {
      extraTools.push({
        name: 'web_search',
        description: '搜索互联网获取最新信息。当你需要了解当前事件、查找最新数据、或获取对话历史之外的信息时使用。返回搜索结果列表，包含标题、链接和摘要。',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索查询关键词' },
            max_results: { type: 'number', description: '最大返回结果数（默认 5）' },
          },
          required: ['query'],
        },
      })
  }

  return extraTools
}

/**
 * Set up MCP connections and discover available tools.
 * Returns the MCP manager and tool definitions ready for registration.
 */
async function setupMCPTools(capabilities?: ChatCapabilities): Promise<{
  mcpManager: MCPManager | null
  mcpToolDefs: typeof FILE_TOOLS
}> {
  if (!capabilities?.activeMcpServiceIds?.length) {
    return { mcpManager: null, mcpToolDefs: [] }
  }

  try {
    const allServices = await getMcpServices() as MCPServiceConfig[]
    const activeServices = allServices.filter(
      (s) => s.enabled && capabilities.activeMcpServiceIds.includes(s.id),
    )

    if (activeServices.length === 0) {
      return { mcpManager: null, mcpToolDefs: [] }
    }

    const mcpManager = new MCPManager()
    const mcpTools = await mcpManager.connectServices(activeServices)

    // Convert MCP tool definitions to the standard AI tool format
    const mcpToolDefs = mcpTools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as typeof FILE_TOOLS[0]['input_schema'],
    }))

    return { mcpManager, mcpToolDefs }
  } catch {
    return { mcpManager: null, mcpToolDefs: [] }
  }
}

// ── Anthropic Client Cache ──

const anthropicClients = new Map<string, AnthropicT>()

function getAnthropicClient(model: AiModel): AnthropicT {
  const key = `${model.apiKey}-${model.baseUrl || 'default'}`
  const existing = anthropicClients.get(key)
  if (existing) return existing

  const client = new Anthropic({
    apiKey: model.apiKey,
    baseURL: model.baseUrl || undefined,
    timeout: 120_000,
    maxRetries: 2,
  })
  anthropicClients.set(key, client)
  return client
}

// ── OpenAI-compatible SSE Parser ──

async function* parseOpenAIStream(response: Response): AsyncGenerator<{ type: 'text'; text: string } | { type: 'tool_call_start'; index: number; id: string; name: string } | { type: 'tool_call_args'; index: number; args: string }> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          const delta = json.choices?.[0]?.delta
          if (!delta) continue

          if (delta.content) {
            yield { type: 'text', text: delta.content }
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.function?.name) {
                yield { type: 'tool_call_start', index: tc.index, id: tc.id, name: tc.function.name }
              }
              if (tc.function?.arguments) {
                yield { type: 'tool_call_args', index: tc.index, args: tc.function.arguments }
              }
            }
          }
        } catch {
          // skip malformed JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ── Streaming Helpers ──

function sendChunk(
  event: Electron.IpcMainInvokeEvent,
  id: string,
  text: string,
) {
  event.sender.send('ai:stream-chunk', { id, text })
}

function sendDone(event: Electron.IpcMainInvokeEvent, id: string) {
  event.sender.send('ai:stream-done', { id })
}

function sendError(
  event: Electron.IpcMainInvokeEvent,
  id: string,
  error: string,
) {
  event.sender.send('ai:stream-error', { id, error })
}

// ── Anthropic Streaming with Tool Use ──

const SYSTEM_PROMPT_BASE = `你是 ArcOffice 的 AI 助手，运行在用户的电脑上。你可以直接读写用户文件系统中的文件，也可以与用户对话。

# 🛠 可用工具

- read_file      读取文件文本内容
- write_file     写入/覆盖文件（创建新文件或完全重写）
- edit_file      查找替换编辑（局部修改）
- list_directory 浏览目录结构
- run_command    执行 shell 命令（npm install、git status、ls 等，超时 30 秒）

# 📋 工作流程

当用户提出需求时：
1. 先理解用户意图，判断是否需要操作文件
2. 如需操作文件：先用 list_directory 或 read_file 了解项目结构
3. 然后用 write_file 或 edit_file 进行操作
4. 修改后展示变更摘要，说明做了什么

⚠️ 注意事项：
- edit_file 的 old_string 必须与文件中内容完全一致（包括缩进空格）
- 如果编辑失败，先 read_file 确认当前内容再尝试
- 所有文件路径使用绝对路径
- run_command 不能运行交互式命令（vim、top 等）

# 💬 回复结构

1. **思考** — 在 <thinking> 标签中先推理，再给出回答：

     <thinking>
     分析用户需求，检索相关文件，推理验证方案。
     </thinking>

   这是最终的回答内容。

2. **语气** — 友好、专业、简洁。技术问题给具体方案，简单问题直接回答。

3. **格式** — 需要时使用 Markdown（见下方速查），不要为用而用。

# 📝 Markdown 速查

基础： #标题 **加粗** *斜体* ~~删除线~~ ==高亮== ++插入++ \`code\`
列表： -无序 1.有序 -[ ]任务  >引用  :smile:
代码： \`\`\`语言名  代码块（自动高亮：ts/py/go/rust/css/bash/json/yaml 等）
Diff： \`\`\`diff  -删除行 +新增行  上下文
表格： |列1|列2|  |---|---|   内容
图表： \`\`\`mermaid  流程图/时序图/甘特图/思维导图/ER图/类图/状态图/C4图 等
      \`\`\`d2       架构图、系统拓扑
      \`\`\`infographic  柱状图/折线图/饼图
数学： $E=mc^2$（行内） $$公式$$（块级）
容器： ::: tip/warning/danger  内容  :::
链接： [文本](URL)  ![图片](URL)
分割： ---

所有代码块和图表由前端自动渲染。长回答用标题和列表组织。`

interface ToolUse {
  name: string
  input: Record<string, unknown>
  id: string
}

async function streamAnthropic(
  event: Electron.IpcMainInvokeEvent,
  id: string,
  client: AnthropicT,
  model: AiModel,
  messages: ChatMessage[],
  capabilities?: ChatCapabilities,
) {
  // Refresh working directory for this stream session
  cachedWorkingDir = null
  await loadWorkingDir()

  // Build dynamic system prompt from capabilities
  const systemPrompt = await buildSystemPrompt(capabilities)
  const extraTools = await buildDynamicTools(capabilities)
  const allTools = [...FILE_TOOLS, ...extraTools]

  // Set up MCP connections and discover tools
  const { mcpManager, mcpToolDefs } = await setupMCPTools(capabilities)
  if (mcpToolDefs.length > 0) {
    allTools.push(...mcpToolDefs)
  }

  try {
    // Convert simple messages to the format expected by the SDK
    const msgs: Array<{ role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> }> =
      messages.map((m) => ({
        role: m.role === 'system' ? 'user' : (m.role as 'user' | 'assistant'),
        content: m.content,
      }))

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const stream = await client.messages.create({
        model: model.modelId,
        max_tokens: model.maxTokens,
        temperature: model.temperature,
        system: systemPrompt,
        messages: msgs as AnthropicT.MessageParam[],
        tools: allTools,
        stream: true,
      })

      let textBuffer = ''
      const toolUses: ToolUse[] = []
      let currentTool: { name: string; id: string } | null = null
      let jsonBuffer = ''

      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'content_block_start': {
            const block = chunk.content_block
            if (block.type === 'tool_use') {
              currentTool = { name: block.name, id: block.id }
              jsonBuffer = ''
            }
            break
          }
          case 'content_block_delta': {
            const delta = chunk.delta
            if (delta.type === 'text_delta') {
              textBuffer += delta.text
              sendChunk(event, id, delta.text)
            } else if (delta.type === 'input_json_delta' && currentTool) {
              jsonBuffer += delta.partial_json
            }
            break
          }
          case 'content_block_stop': {
            if (currentTool) {
              try {
                const input = JSON.parse(jsonBuffer)
                toolUses.push({ name: currentTool.name, input, id: currentTool.id })
              } catch {
                toolUses.push({ name: currentTool.name, input: {}, id: currentTool.id })
              }
              currentTool = null
            }
            break
          }
        }
      }

      // No tool calls — we're done
      if (toolUses.length === 0) {
        sendDone(event, id)
        return
      }

      // Build assistant message with text + tool_use blocks
      const assistantBlocks: Record<string, unknown>[] = []
      if (textBuffer) {
        assistantBlocks.push({ type: 'text', text: textBuffer })
      }
      for (const tu of toolUses) {
        assistantBlocks.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input })
      }
      msgs.push({ role: 'assistant', content: assistantBlocks })

      // Execute tools and build tool_result blocks
      const resultBlocks: Record<string, unknown>[] = []
      for (const tu of toolUses) {
        try {
          // Route MCP tools through the MCP manager first
          let result: unknown
          if (mcpManager?.isMCPTool(tu.name)) {
            result = await mcpManager.callTool(tu.name, tu.input)
          } else {
            result = await executeTool(tu.name, tu.input)
          }
          resultBlocks.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          })
        } catch (err) {
          resultBlocks.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: err instanceof Error ? err.message : String(err),
            is_error: true,
          })
        }
      }
      msgs.push({ role: 'user', content: resultBlocks })
    }

    // Exceeded maximum tool rounds
    sendChunk(event, id, '\n\n[已达到最大操作次数，如需继续请重新提问]')
    sendDone(event, id)
  } finally {
    // Clean up MCP connections
    await mcpManager?.closeAll().catch(() => {})
  }
}

// ── OpenAI-compatible Streaming with Tool Calls ──

async function streamOpenAI(
  event: Electron.IpcMainInvokeEvent,
  id: string,
  model: AiModel,
  messages: ChatMessage[],
  capabilities?: ChatCapabilities,
) {
  // Refresh working directory for this stream session
  cachedWorkingDir = null
  await loadWorkingDir()

  const baseUrl = model.baseUrl || 'https://api.openai.com/v1'

  // Build dynamic system prompt from capabilities
  const systemPrompt = await buildSystemPrompt(capabilities)
  const extraTools = await buildDynamicTools(capabilities)
  const allTools = [...FILE_TOOLS, ...extraTools]

  // Set up MCP connections and discover tools
  const { mcpManager, mcpToolDefs } = await setupMCPTools(capabilities)
  if (mcpToolDefs.length > 0) {
    allTools.push(...mcpToolDefs)
  }

  try {
    // Convert messages to OpenAI format
    const oaiMessages: Record<string, unknown>[] = messages.map((m) => ({
      role: m.role === 'system' ? 'system' : m.role,
      content: m.content,
    }))

    // Add system prompt for tools
    oaiMessages.unshift({ role: 'system', content: systemPrompt })

    const openaiTools = allTools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }))

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${model.apiKey}`,
        },
        body: JSON.stringify({
          model: model.modelId,
          max_tokens: model.maxTokens,
          temperature: model.temperature,
          stream: true,
          messages: oaiMessages,
          tools: openaiTools,
        }),
        signal: AbortSignal.timeout(120_000),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`OpenAI API error ${response.status}: ${body}`)
      }

      let textBuffer = ''
      const toolCallsMap = new Map<number, { id: string; name: string; args: string }>()

      for await (const event_ of parseOpenAIStream(response)) {
        if (event_.type === 'text') {
          textBuffer += event_.text
          sendChunk(event, id, event_.text)
        } else if (event_.type === 'tool_call_start') {
          const existing = toolCallsMap.get(event_.index) || { id: '', name: '', args: '' }
          existing.id = event_.id
          existing.name = event_.name
          toolCallsMap.set(event_.index, existing)
        } else if (event_.type === 'tool_call_args') {
          const existing = toolCallsMap.get(event_.index) || { id: '', name: '', args: '' }
          existing.args += event_.args
          toolCallsMap.set(event_.index, existing)
        }
      }

      if (toolCallsMap.size === 0) {
        // No tool calls — done
        sendDone(event, id)
        return
      }

      // Build assistant message
      const assistantMsg: Record<string, unknown> = {
        role: 'assistant',
        content: textBuffer || null,
      }
      const toolCalls: Record<string, unknown>[] = []
      for (const [, tc] of toolCallsMap) {
        toolCalls.push({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: tc.args,
          },
        })
      }
      if (toolCalls.length > 0) {
        assistantMsg.tool_calls = toolCalls
      }
      oaiMessages.push(assistantMsg)

      // Execute tools and add tool result messages
      for (const [, tc] of toolCallsMap) {
        try {
          let input: Record<string, unknown> = {}
          try {
            input = JSON.parse(tc.args)
          } catch {
            input = {}
          }

          // Route MCP tools through the MCP manager first
          let result: unknown
          if (mcpManager?.isMCPTool(tc.name)) {
            result = await mcpManager.callTool(tc.name, input)
          } else {
            result = await executeTool(tc.name, input)
          }

          oaiMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          })
        } catch (err) {
          oaiMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    sendChunk(event, id, '\n\n[已达到最大操作次数，如需继续请重新提问]')
    sendDone(event, id)
  } finally {
    // Clean up MCP connections
    await mcpManager?.closeAll().catch(() => {})
  }
}

// ── IPC Handlers ──

const streamIds = new Set<string>()

/**
 * Start a streaming chat completion with file operation tool support.
 * The AI can read, write, and edit files on the user's filesystem.
 * Tool calls and results are handled transparently — only text is streamed to the renderer.
 */
export async function chatStream(
  _event: Electron.IpcMainInvokeEvent,
  params: ChatParams,
) {
  const id = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  streamIds.add(id)

  const { model, messages, capabilities } = params

  // Fire-and-forget: the stream runs async, pushing events to renderer
  ;(async () => {
    try {
      if (model.provider === 'anthropic') {
        const client = getAnthropicClient(model)
        await streamAnthropic(_event, id, client, model, messages, capabilities)
      } else if (model.provider === 'openai-compatible') {
        await streamOpenAI(_event, id, model, messages, capabilities)
      } else {
        throw new Error(`不支持的提供商: ${model.provider}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (streamIds.has(id)) {
        sendError(_event, id, message)
      }
    } finally {
      streamIds.delete(id)
    }
  })()

  return { id }
}

/**
 * Test a model connection by sending a single message.
 */
export async function testConnection(
  _event: Electron.IpcMainInvokeEvent,
  model: AiModel,
): Promise<{ success: boolean; message: string }> {
  try {
    if (model.provider === 'anthropic') {
      const client = new Anthropic({
        apiKey: model.apiKey,
        baseURL: model.baseUrl || undefined,
        timeout: 15_000,
        maxRetries: 0,
      })
      await client.messages.create({
        model: model.modelId,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      })
      return { success: true, message: '连接成功' }
    }

    if (model.provider === 'openai-compatible') {
      const baseUrl = model.baseUrl || 'https://api.openai.com/v1'
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${model.apiKey}`,
        },
        body: JSON.stringify({
          model: model.modelId,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        return { success: false, message: `HTTP ${response.status}: ${body}` }
      }
      return { success: true, message: '连接成功' }
    }

    return { success: false, message: `不支持的提供商: ${model.provider}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message }
  }
}
