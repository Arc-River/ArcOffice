/**
 * 开发辅助：在浏览器（非 Electron）中注入 mock electronAPI，
 * 方便直接在 Chrome DevTools 中调试 UI 布局和样式。
 *
 * 仅在 Vite 开发环境下且 window.electronAPI 不存在时生效。
 */
export function setupDevMock() {
  if (window.electronAPI) return
  if (!import.meta.env.DEV) return

  console.log('[DevMock] 注入 mock electronAPI（仅在浏览器开发模式）')

  window.electronAPI = {
    // 文件操作
    listDirectory: async () => [],
    readFileText: async () => '',

    // 配置
    getConfig: async () => '',
    setConfig: async () => {},

    // 对话框
    openFileDialog: async () => null,
    selectDirectory: async () => null,

    // 文件历史
    getFileHistory: async () => [],
    addFileHistory: async () => {},

    // 任务
    createTask: async () => ({
      id: 0,
      type: '',
      status: 'pending',
      progress: 0,
      log: '',
      created_at: new Date().toISOString(),
    }),
    updateTaskProgress: async () => {},
    getTasks: async () => [],

    // 同步聊天（非流式）
    chatCompletion: async () => '这是 mock 环境的测试回复。如需流式聊天，请使用 chatStream。',

    // AI Chat — 默认发送一段含 <thinking> 标签的 Markdown 演示
    chatStream: async () => ({ id: 'mock-stream-1' }),
    onStreamChunk: (() => {
      let timer: ReturnType<typeof setTimeout> | null = null
      return (cb: (data: { id: string; text: string }) => void) => {
        const thinkingMd = [
          '\n\n<thinking>',
          '这是 AI 的**思考过程**。',
          '',
          '- 分析用户需求',
          '- 检索相关知识',
          '- 推理验证方案',
          '- 整理最终回答',
          '',
          '```typescript',
          'function process(input: string) {',
          '  return `处理完成: ${input}`',
          '}',
          '```',
          '',
          '> 经过验证，方案可行。',
          '</thinking>',
          '',
          '根据以上分析，**这是最终的回复**。',
          '',
          '如有疑问请继续提问。',
        ].join('\n')
        timer = setTimeout(() => cb({ id: 'mock-stream-1', text: thinkingMd }), 500)
        return () => {
          if (timer) clearTimeout(timer)
        }
      }
    })(),
    onStreamDone: (() => {
      let timer: ReturnType<typeof setTimeout> | null = null
      return (cb: (data: { id: string }) => void) => {
        timer = setTimeout(() => cb({ id: 'mock-stream-1' }), 1500)
        return () => {
          if (timer) clearTimeout(timer)
        }
      }
    })(),
    onStreamError: () => () => {},
    removeStreamListeners: () => {},

    // AI 模型 — 提供测试用模型，绕过"未配置模型"提示
    getAiModels: async () => [
      {
        id: 'mock-model',
        name: 'Mock Model',
        provider: 'openai-compatible',
        modelId: 'gpt-4',
        apiKey: 'mock-key',
        baseUrl: 'http://localhost:9999/v1',
        temperature: 0.7,
        maxTokens: 2048,
      },
    ],
    saveAiModels: async () => {},
    getActiveModel: async () => 'mock-model',
    setActiveModel: async () => {},
    testConnection: async () => ({ success: false, message: 'mock 环境无法测试连接' }),

    // 会话
    listSessions: async () => [],
    createSession: async (name) => ({
      id: `mock-session-${Date.now()}`,
      name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    renameSession: async () => {},
    deleteSession: async () => {},
    getMessages: async () => [],
    saveMessages: async () => {},

    // Skills
    getSkills: async () => [
      {
        id: 'docx',
        name: 'docx',
        description: 'Word 文档创建与编辑：使用 docx（npm）包创建新文档，或解压/编辑 XML 修改现有文档',
        content:
          '使用 docx（npm 包）创建 Word 文档。创建时页面尺寸默认 A4（12240 x 15840），如需 Letter 纸请手动设定。表格需要双重宽度设置。使用 ShadingType.CLEAR 而非 SOLID。列表必须用 numbering 配置。',
        builtin: true,
        enabled: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'xlsx',
        name: 'xlsx',
        description: 'Excel 电子表格处理：使用 openpyxl 创建/编辑 xlsx 文件，支持公式和格式',
        content:
          '使用 openpyxl 处理 Excel 文件。专业字体：Arial / Times New Roman。零公式错误，通过 LibreOffice 重新计算验证。优先使用 Excel 2007 时代的函数（SUMIFS, INDEX, MATCH 等）。',
        builtin: true,
        enabled: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'pdf',
        name: 'pdf',
        description: 'PDF 文件处理：提取文本/表格、合并、拆分、创建 PDF',
        content:
          '使用 pypdf 提取文本、合并拆分 PDF。使用 pdfplumber 提取表格。使用 reportlab 创建新 PDF。命令行工具：pdftotext, qpdf, pdftk。',
        builtin: true,
        enabled: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'pptx',
        name: 'pptx',
        content:
          '使用 pptxgenjs（npm）创建演示文稿。使用 LAYOUT_16x9（10" x 5.625"）。颜色不要 # 前缀。图表需要完整的轴线声明。验证始终是强制性的。',
        description: 'PowerPoint 演示文稿：使用 pptxgenjs 创建/编辑幻灯片',
        builtin: true,
        enabled: true,
        created_at: new Date().toISOString(),
      },
    ],
    saveSkills: async () => {},

    // MCP
    getMcpServices: async () => [
      {
        id: 'mcp-chrome-devtools',
        name: 'chrome-devtools',
        type: 'stdio',
        command: 'npx',
        args: ['chrome-devtools-mcp'],
        url: '',
        env: {},
        enabled: true,
        created_at: new Date().toISOString(),
      },
    ],
    saveMcpServices: async () => {},
  }
}
