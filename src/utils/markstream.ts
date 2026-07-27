/**
 * markstream-vue 全局配置
 *
 * 启用可选功能：Mermaid / D2 / KaTeX / Infographic / stream-diffs
 * Shiki 代码高亮通过 MarkdownRender 的 codeBlockDarkTheme / codeBlockLightTheme prop 启用。
 */
import {
  enableD2,
  enableInfographic,
  enableKatex,
  enableMermaid,
  setD2Loader,
  setDefaultMathOptions,
  setKatexLoader,
  setMermaidLoader,
} from 'markstream-vue'

/**
 * 在应用初始化时调用一次，启用 markstream-vue 可选功能。
 */
export function initMarkstreamFeatures() {
  // 启用的功能及其 loader。markstream-vue 内部通过 Worker/CDN 加载，
  // 这里使用 dynamic import 传递本地已安装的包路径，框架会自动处理。
  enableMermaid()
  setMermaidLoader(() => import('mermaid'))

  enableD2()
  setD2Loader(() => import('@terrastruct/d2'))

  enableKatex()
  setKatexLoader(() => import('katex'))
  setDefaultMathOptions({
    throwOnError: false,
    errorColor: '#cc0000',
    output: 'html',
  })

  // Infographic — enableInfographic 直接接收 loader，不需要额外 setter
  enableInfographic(() => import('@antv/infographic'))
}

/**
 * 针对 AI 聊天场景的 MarkdownRender 默认 props 预设。
 * ChatMessage.vue 中可以展开使用。
 */
export const chatPreset: Record<string, unknown> = {
  mode: 'chat',
  fade: false,
  batchRendering: true,
  renderBatchSize: 16,
  renderBatchDelay: 8,
  renderBatchBudgetMs: 4,
  maxLiveNodes: 0,
}

/**
 * 代码块主题配置。
 * 传入 codeBlockDarkTheme / codeBlockLightTheme 启用 Shiki 高亮。
 *
 * 可用内置主题列表见：https://shiki.style/themes
 * 常用：'vitesse-dark' / 'vitesse-light', 'github-dark' / 'github-light',
 *       'one-dark-pro' / 'one-light', 'material-theme' / 'material-theme-lighter'
 */
export const codeBlockThemes = {
  codeBlockDarkTheme: 'github-dark',
  codeBlockLightTheme: 'github-light',
}
