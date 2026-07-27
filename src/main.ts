import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from '@/App.vue'
import i18n from '@/i18n'
import router from '@/router'
import { useThemeStore } from '@/stores/theme'

// 开发辅助：浏览器调试时注入 mock electronAPI
import { setupDevMock } from '@/utils/dev-mock'

setupDevMock()

// 启用 markstream-vue 可选功能（Mermaid / D2 / KaTeX / Infographic）
import { initMarkstreamFeatures } from '@/utils/markstream'

initMarkstreamFeatures()

// 注册自定义 <thinking> 标签组件（需在第一个 ChatMessage 渲染前完成）
import { setCustomComponents } from 'markstream-vue'
import ThinkingBlock from '@/components/chat/ThinkingBlock.vue'

setCustomComponents({ thinking: ThinkingBlock })

// Import Element Plus dark mode CSS variables (activates when html.dark)
import 'element-plus/theme-chalk/dark/css-vars.css'

// Import markstream-vue CSS for streaming markdown rendering
import 'markstream-vue/index.css'

// Import global styles
import '@/assets/styles/global.scss'
import '@/assets/styles/element-vars.scss'
import '@/assets/styles/common.scss'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)

// Initialize theme BEFORE mount to prevent flash
const themeStore = useThemeStore()
themeStore.init()

app.mount('#app')
