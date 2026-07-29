import Anthropic from '@anthropic-ai/sdk'
import type AnthropicT from '@anthropic-ai/sdk'
import { exec as execCallback } from 'node:child_process'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { promisify } from 'node:util'
import { app } from 'electron'
import { getDb, getMcpServices, queryRow } from './db'
import { getSkills, readSkillFile, runScript as runSkillScript } from './skills'
import { isPathAllowed as checkPathAllowed } from './path-utils'
import { MCPManager, type MCPServiceConfig } from './mcp-client'

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
  name: string
  description: string
  content?: string
  builtin?: boolean
  enabled: boolean
  created_at: string
  hasScripts?: boolean
  fileCount?: number
}

interface ChatParams {
  model: AiModel
  messages: ChatMessage[]
  capabilities?: ChatCapabilities
}

// ── Title Generation ──

function truncateSmart(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  // Try to break at a sentence boundary first
  const truncated = text.slice(0, maxLen)
  const lastPunct = Math.max(
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('！'),
    truncated.lastIndexOf('？'),
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('，'),
    truncated.lastIndexOf(','),
  )
  const end = lastPunct > maxLen * 0.5 ? lastPunct + 1 : maxLen
  return text.slice(0, end).trimEnd() + '…'
}

export async function generateTitle(
  _event: Electron.IpcMainInvokeEvent,
  model: AiModel,
  firstMessage: string,
  firstResponse: string,
): Promise<string> {
  const userSnippet = firstMessage.slice(0, 400).trim()
  const responseSnippet = firstResponse.slice(0, 500).trim()

  const titlePrompt = `Generate a short title (<=30 chars) for this conversation. The title MUST capture the user's INTENT or TOPIC — do NOT just repeat the opening words.

User: ${userSnippet}
Assistant: ${responseSnippet}

Examples:
- "帮我写一份季度销售报告" → "季度销售报告"
- "分析这份财务报表并给出建议" → "财务报表分析"
- "What's the capital of France?" → "France Capital"
- "请把这篇文章翻译成英文" → "文章翻译"
- "Help me debug this Python function" → "Debug Python Function"

Title (<=30 chars, same language as conversation):`

  try {
    const client = getAnthropicClient(model)
    const result = await client.messages.create({
      model: model.modelId,
      max_tokens: 60,
      temperature: 0.5,
      system: 'You are a title generator. Output ONLY the title — no quotes, no punctuation, no prefix, no explanation.',
      messages: [{ role: 'user', content: titlePrompt }],
    })
    const content = result.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
    if (content && content.length >= 2 && content.length <= 30) {
      return content
    }
    // If AI returned something reasonable but longer, truncate smartly
    if (content && content.length > 30) {
      return truncateSmart(content, 30)
    }
    // Fallback to smart truncation of user message
    return truncateSmart(firstMessage, 24)
  } catch {
    return truncateSmart(firstMessage, 24)
  }
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

interface ToolDef {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

// ── File Operation Tools ──

const FILE_TOOLS: ToolDef[] = [
  {
    name: 'read_file',
    description: 'Read text content from a file (UTF-8). Use for viewing source code, config, JSON, Markdown, and other plain text files.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write text content to a file (overwrite). Creates the file if it does not exist. Use for creating new files or completely rewriting existing files. Note: only supports plain text, cannot generate binary formats like .docx/.xlsx/.pptx.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
        content: { type: 'string', description: 'Complete file content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Perform precise search-and-replace on text files. old_string must exactly match the existing content (including indentation and whitespace). Only the first match is replaced. Use for partial text modifications. Does not support binary formats.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
        old_string: { type: 'string', description: 'Exact text to replace (must match existing content exactly)' },
        new_string: { type: 'string', description: 'Replacement text' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'list_directory',
    description: 'List all files and directories in a specified path. Use for browsing project structure and finding files.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the directory' },
      },
      required: ['path'],
    },
  },
  {
    name: 'run_command',
    description: `Execute a shell command on the user's machine (non-interactive). Use for running build commands, installing dependencies, starting services, executing scripts, and viewing files. Commands run in the working directory. Note: interactive commands (vim, top, etc.) are not supported.`,
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
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
    throw new Error(`Permission denied: path ${targetPath}`)
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
        let hint = `Exact match not found in the file.`
        if (matchLine >= 0) {
          const context = lines.slice(Math.max(0, matchLine - 1), matchLine + 2).join('\n')
          hint += ` Found similar content near line ${matchLine + 1}, but indentation or formatting does not match exactly. Nearby content:\n${context}`
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
      throw new Error(`Unknown tool: ${name}`)
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
  if (!wsConfig?.api_key) throw new Error('Web search is not configured. Please set up an API Key in Settings.')
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

/**
 * Execute a shell command on the user's machine.
 */
async function executeRunCommand(input: Record<string, unknown>): Promise<unknown> {
  const command = String(input.command)
  const cwd = cachedWorkingDir || app.getPath('documents')

  if (!isPathAllowed(cwd)) {
    throw new Error(`Permission denied: working directory ${cwd} is not allowed`)
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
        (s) => s.enabled && capabilities.activeSkillIds.includes(s.name),
      )

      if (activeSkills.length > 0) {
        const parts = activeSkills.map(
          (s) => `### ${s.name}\n${s.description ? `> ${s.description}\n` : ''}\n${s.content || ''}`,
        )
        skillsSection = [
          '',
          '# 🧰 Active Skill Instructions',
          'The following skills are activated. Please strictly follow their guidelines when performing related tasks:',
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
            return `  - **${s.name}** (local): \`${s.command} ${s.args.join(' ')}\``
          }
          return `  - **${s.name}** (remote): ${s.url}`
        })

        mcpSection = [
          '',
          '# 🔌 External Tools (MCP Services)',
          'The following MCP services are active. Their tools are registered in your available tool list. Use `mcp__serviceName__toolName` to call them. Each tool connects and executes automatically.',
          '',
          'Active services:',
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
        '# 🌐 Web Search',
        'Web search is enabled. Use the web_search tool to search the internet for the latest information.',
        '',
      ].join('\n')
    } else {
      webSearchSection = [
        '',
        '# 🌐 Web Search',
        'Web search is enabled but no API Key is configured. Set up a Tavily API Key in Settings to enable search functionality.',
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
async function buildDynamicTools(capabilities?: ChatCapabilities): Promise<ToolDef[]> {
  const extraTools: ToolDef[] = []

  if (capabilities?.webSearch) {
    const config = getWebSearchConfig()
    if (config?.api_key) {
      extraTools.push({
        name: 'web_search',
        description: 'Search the internet for the latest information. Use when you need current events, recent data, or information outside the conversation history. Returns search results with titles, links, and summaries.',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query keywords' },
            max_results: { type: 'number', description: 'Maximum number of results (default 5)' },
          },
          required: ['query'],
        },
      })
    }
  }

  // Expose skill script tools when skills are active
  if (capabilities?.activeSkillIds?.length) {
    try {
      const allSkills = await getSkills() as SkillItem[]
      const activeSkills = allSkills.filter(
        (s) => s.enabled && capabilities.activeSkillIds.includes(s.name) && s.hasScripts,
      )

      if (activeSkills.length > 0) {
        const skillNames = activeSkills.map((s) => s.name).join(', ')

        extraTools.push({
          name: 'run_skill_script',
          description: `Execute a script file inside an activated skill directory (${skillNames}). Use when a skill instruction tells you to run its script. Provide the skill name and relative script path.`,
          input_schema: {
            type: 'object',
            properties: {
              skill_name: { type: 'string', description: `Name of the skill. One of: ${skillNames}` },
              script_path: { type: 'string', description: 'Relative path to the script within the skill directory (e.g. scripts/recalc.py)' },
              args: { type: 'string', description: 'Optional command-line arguments' },
            },
            required: ['skill_name', 'script_path'],
          },
        })

        extraTools.push({
          name: 'read_skill_file',
          description: `Read a file from an activated skill directory (${skillNames}). Use to view the content of skill scripts, documentation, or reference files.`,
          input_schema: {
            type: 'object',
            properties: {
              skill_name: { type: 'string', description: `Name of the skill. One of: ${skillNames}` },
              file_path: { type: 'string', description: 'Relative path to the file within the skill directory (e.g. SKILL.md, scripts/recalc.py)' },
            },
            required: ['skill_name', 'file_path'],
          },
        })
      }
    } catch {
      // Skills not available — skip
    }
  }

  return extraTools
}

/**
 * Set up MCP connections and discover available tools.
 * Returns the MCP manager and tool definitions ready for registration.
 */
async function setupMCPTools(capabilities?: ChatCapabilities): Promise<{
  mcpManager: MCPManager | null
  mcpToolDefs: ToolDef[]
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
      input_schema: t.inputSchema as ToolDef['input_schema'],
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

const SYSTEM_PROMPT_BASE = `You are the ArcOffice AI assistant, running on the user's computer. You can read and write files directly on the user's filesystem and converse with the user.

# Available Tools

- read_file      Read file content
- write_file     Write/overwrite file (create or replace)
- edit_file      Search-and-replace edit (partial modification)
- list_directory Browse directory structure
- run_command    Execute shell command (npm install, git status, ls, etc., 30s timeout)

# Workflow

When the user makes a request:
1. First understand their intent and determine if file operations are needed
2. Use list_directory or read_file to understand the structure first
3. Use write_file or edit_file to make changes
4. Summarize what was changed

⚠️ Important Notes:
- edit_file old_string must exactly match the file content (including indentation and whitespace)
- If editing fails, use read_file first to confirm current content
- Always use absolute paths for file operations
- run_command cannot run interactive commands (vim, top, etc.)
- File operations are restricted to the configured working directory. All read/write/edit/list_directory
  operations outside of this directory will be denied.

# Response Format

1. **Thinking** — Reason inside <thinking> tags before answering:

     <thinking>
     Analyze user needs, retrieve relevant files, validate approach.
     </thinking>

   This is the final answer.

2. **Tone** — Friendly, professional, concise. Give concrete solutions for technical issues, direct answers for simple questions.

3. **Format** — Use Markdown when appropriate (see reference below).

# Markdown Reference

Basics: # H1 **bold** *italic* ~~strikethrough~~ ==highlight== ++insert++ \`code\`
Lists: - ul 1. ol -[ ] task > blockquote :smile:
Code: \`\`\`lang  fenced code blocks (auto-highlight: ts/py/go/rust/css/bash/json/yaml etc.)
Diff: \`\`\`diff  -deleted +added  context
Tables: |col1|col2|  |---|---|  content
Diagrams: \`\`\`mermaid  flowchart/sequence/gantt/mindmap/ER/class/state/C4
      \`\`\`d2       system architecture, topology
      \`\`\`infographic  bar/line/pie charts
Math: $E=mc^2$ (inline) $$formula$$ (block)
Containers: ::: tip/warning/danger  content  :::
Links: [text](URL)  ![image](URL)
Divider: ---

All code blocks and diagrams are rendered automatically. Use headings and lists for long answers.`

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
          } else if (tu.name === 'run_skill_script') {
            const input = tu.input as Record<string, unknown>
            const r = await runSkillScript(
              undefined,
              String(input.skill_name),
              String(input.script_path),
              String(input.args || ''),
            )
            result = `Exit code: ${r.exitCode}\n${r.stdout}${r.stderr ? '\nStderr:\n' + r.stderr : ''}`
          } else if (tu.name === 'read_skill_file') {
            const input = tu.input as Record<string, unknown>
            result = await readSkillFile(
              undefined,
              String(input.skill_name),
              String(input.file_path),
            )
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
    sendChunk(event, id, '\n\n[Maximum operations reached. Please ask a new question to continue.]')
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
      toolCallsMap.forEach((tc) => {
        toolCalls.push({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: tc.args,
          },
        })
      })
      if (toolCalls.length > 0) {
        assistantMsg.tool_calls = toolCalls
      }
      oaiMessages.push(assistantMsg)

      // Execute tools and add tool result messages
      toolCallsMap.forEach(async (tc) => {
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
      })
    }

    sendChunk(event, id, '\n\n[Maximum operations reached. Please ask a new question to continue.]')
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
        throw new Error(`Unsupported provider: ${model.provider}`)
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
      return { success: true, message: 'Connection successful' }
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
      return { success: true, message: 'Connection successful' }
    }

    return { success: false, message: `Unsupported provider: ${model.provider}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message }
  }
}
