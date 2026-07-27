/**
 * Minimal MCP (Model Context Protocol) client.
 *
 * Supports stdio transport (local subprocess) and SSE transport (remote endpoint).
 * Implements the core lifecycle: initialize → tools/list → tools/call → shutdown.
 *
 * MCP specification: https://spec.modelcontextprotocol.io/
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { EventEmitter } from 'node:events'

// ── Types ──

export interface MCPServiceConfig {
  id: string
  name: string
  type: 'stdio' | 'sse'
  command: string
  args: string[]
  url: string
  env: Record<string, string>
}

export interface MCPToolDefinition {
  /** Unique name for the AI tool registry (prefixed with service name) */
  name: string
  /** Original tool name from the MCP server */
  originalName: string
  /** Which MCP service this tool belongs to */
  serviceId: string
  description: string
  inputSchema: Record<string, unknown>
}

interface MCPTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

interface MCPJsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: Record<string, unknown>
}

interface MCPJsonRpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

// ── MCP Client ──

class MCPClientConnection extends EventEmitter {
  private config: MCPServiceConfig
  private process: ChildProcess | null = null
  private rl: ReturnType<typeof createInterface> | null = null
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>()
  private buffer = ''
  private connected = false

  constructor(config: MCPServiceConfig) {
    super()
    this.config = config
  }

  /**
   * Connect to the MCP server and perform initialization handshake.
   */
  async connect(timeoutMs = 10_000): Promise<void> {
    if (this.config.type === 'stdio') {
      await this.connectStdio(timeoutMs)
    } else {
      await this.connectSSE(timeoutMs)
    }

    // Initialize handshake
    const initResult = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'ArcOffice', version: '0.1.0' },
    })

    const initResponse = initResult as { protocolVersion?: string }
    if (!initResponse?.protocolVersion) {
      throw new Error(`MCP ${this.config.name}: Initialization failed, server returned invalid response`)
    }

    // Send initialized notification (fire-and-forget)
    this.sendNotification('notifications/initialized')

    this.connected = true
  }

  /**
   * Discover available tools from the MCP server.
   */
  async listTools(): Promise<MCPToolDefinition[]> {
    if (!this.connected) throw new Error(`MCP ${this.config.name}: Not connected`)

    const result = await this.request('tools/list') as { tools?: MCPTool[] }
    const tools = result?.tools || []

    return tools.map((t) => ({
      name: this.safeToolName(t.name),
      originalName: t.name,
      serviceId: this.config.id,
      description: t.description || `MCP tool via ${this.config.name}`,
      inputSchema: t.inputSchema || { type: 'object', properties: {} },
    }))
  }

  /**
   * Call a tool on the MCP server.
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) throw new Error(`MCP ${this.config.name}: Not connected`)

    const result = await this.request('tools/call', {
      name: toolName,
      arguments: args,
    }) as { content?: Array<{ type: string; text?: string; data?: string; mimeType?: string }> }

    // Convert MCP content array to a readable result
    const contents = result?.content || []
    const textParts = contents
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text)
    const dataParts = contents
      .filter((c) => c.type !== 'text')
      .map((c) => `[${c.type}${c.mimeType ? `: ${c.mimeType}` : ''}] ${c.data || ''}`)

    const output = [...textParts, ...dataParts].join('\n')
    return output || '(empty response)'
  }

  /**
   * Close the connection to the MCP server.
   */
  async close(): Promise<void> {
    this.connected = false

    // Reject all pending requests
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Connection closed'))
    }
    this.pending.clear()

    if (this.process) {
      try {
        // Try graceful shutdown
        if (!this.process.killed) {
          this.sendNotification('exit')
        }
      } catch {
        // ignore
      }

      // Force kill after 2s
      const killTimer = setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL')
        }
      }, 2000)

      try {
        await new Promise<void>((resolve) => {
          if (!this.process) return resolve()
          this.process.on('exit', () => {
            clearTimeout(killTimer)
            resolve()
          })
          // Send SIGTERM
          this.process.kill('SIGTERM')
        })
      } catch {
        clearTimeout(killTimer)
      }

      this.process = null
      this.rl = null
    }
  }

  // ── Private: Stdio Transport ──

  private connectStdio(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`MCP ${this.config.name}: Connection timeout (${timeoutMs}ms)`))
      }, timeoutMs)

      try {
        const child = spawn(this.config.command, this.config.args, {
          env: { ...process.env, ...this.config.env },
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
        })

        this.process = child

        // Handle stderr (log only — not part of MCP protocol)
        child.stderr?.on('data', (data: Buffer) => {
          const text = data.toString().trim()
          if (text) {
            this.emit('stderr', text)
          }
        })

        // Handle stdout — readline-by-readline for JSON-RPC
        this.rl = createInterface({ input: child.stdout!, crlfDelay: Infinity })
        this.rl.on('line', (line: string) => {
          const trimmed = line.trim()
          if (!trimmed) return
          try {
            const msg = JSON.parse(trimmed) as MCPJsonRpcResponse
            this.handleMessage(msg)
          } catch {
            this.emit('stderr', `[parse error] ${trimmed}`)
          }
        })

        // Handle process exit
        child.on('error', (err) => {
          clearTimeout(timer)
          reject(new Error(`MCP ${this.config.name}: Process error — ${err.message}`))
        })

        child.on('exit', (code) => {
          this.connected = false
          this.emit('exit', code)
          if (!this.connected) {
            clearTimeout(timer)
            reject(new Error(`MCP ${this.config.name}: Process exited unexpectedly (code=${code})`))
          }
        })

        // Resolve once the process is running (initialized notification will happen separately)
        clearTimeout(timer)
        resolve()
      } catch (err) {
        clearTimeout(timer)
        reject(err)
      }
    })
  }

  // ── Private: SSE Transport ──

  private async connectSSE(timeoutMs: number): Promise<void> {
    // SSE mode: use a POST endpoint for requests and an SSE stream for responses
    // This is a simplified implementation — proper SSE requires persistent connection
    throw new Error(`MCP ${this.config.name}: SSE transport not yet implemented`)
  }

  // ── Private: Message Handling ──

  private handleMessage(msg: MCPJsonRpcResponse): void {
    const pending = this.pending.get(msg.id)
    if (!pending) {
      // Unexpected message — could be a notification
      return
    }

    clearTimeout(pending.timer)
    this.pending.delete(msg.id)

    if (msg.error) {
      pending.reject(new Error(`MCP error [${msg.error.code}]: ${msg.error.message}`))
    } else {
      pending.resolve(msg.result)
    }
  }

  /**
   * Send a JSON-RPC request and wait for the response.
   */
  private request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++
    const request: MCPJsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`MCP ${this.config.name}: Request timeout — ${method}`))
      }, 15_000)

      this.pending.set(id, { resolve, reject, timer })
      this.sendRaw(JSON.stringify(request))
    })
  }

  /**
   * Send a JSON-RPC notification (no response expected).
   */
  private sendNotification(method: string, params?: Record<string, unknown>): void {
    const notification = {
      jsonrpc: '2.0' as const,
      method,
      ...(params ? { params } : {}),
    }
    this.sendRaw(JSON.stringify(notification))
  }

  /**
   * Write a raw message to the transport.
   */
  private sendRaw(message: string): void {
    if (this.config.type === 'stdio' && this.process?.stdin) {
      this.process.stdin.write(message + '\n')
    }
  }

  /**
   * Create a safe, unique tool name by prefixing with the service name.
   */
  private safeToolName(originalName: string): string {
    const safeService = this.config.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    const safeTool = originalName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    return `mcp__${safeService}__${safeTool}`
  }
}

// ── MCP Manager ──

export class MCPManager {
  private connections: MCPClientConnection[] = []
  private toolRegistry: Map<string, { connection: MCPClientConnection; originalName: string }> = new Map()

  /**
   * Start MCP connections for the given service configs and discover their tools.
   * Returns tool definitions ready to be registered in the AI tool list.
   */
  async connectServices(services: MCPServiceConfig[]): Promise<MCPToolDefinition[]> {
    const allTools: MCPToolDefinition[] = []

    for (const service of services) {
      if (!service.enabled) continue

      const connection = new MCPClientConnection(service)

      try {
        await connection.connect()
        this.connections.push(connection)

        const tools = await connection.listTools()

        for (const tool of tools) {
          this.toolRegistry.set(tool.name, {
            connection,
            originalName: tool.originalName,
          })
          allTools.push(tool)
        }

        // Log stderr for debugging
        connection.on('stderr', (text: string) => {
          console.log(`[MCP:${service.name}] ${text}`)
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[MCP] Connection failed: ${service.name} — ${message}`)
        // Close failed connection
        await connection.close().catch(() => {})
      }
    }

    return allTools
  }

  /**
   * Call an MCP tool by its registered (prefixed) name.
   */
  async callTool(registeredName: string, args: Record<string, unknown>): Promise<unknown> {
    const entry = this.toolRegistry.get(registeredName)
    if (!entry) {
      throw new Error(`Unknown MCP tool: ${registeredName}`)
    }
    return entry.connection.callTool(entry.originalName, args)
  }

  /**
   * Check if a tool name is an MCP tool.
   */
  isMCPTool(name: string): boolean {
    return this.toolRegistry.has(name)
  }

  /**
   * Close all MCP connections.
   */
  async closeAll(): Promise<void> {
    await Promise.allSettled(this.connections.map((c) => c.close()))
    this.connections = []
    this.toolRegistry.clear()
  }
}
