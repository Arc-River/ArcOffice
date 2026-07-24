import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from '@/App.vue'
import i18n from '@/i18n'
import router from '@/router'
import { useThemeStore } from '@/stores/theme'

// Import Element Plus dark mode CSS variables (activates when html.dark)
import 'element-plus/theme-chalk/dark/css-vars.css'

// Import markstream-vue CSS for streaming markdown rendering
import 'markstream-vue/index.css'

// Import global styles
import '@/assets/styles/global.scss'
import '@/assets/styles/element-vars.scss'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)

// Initialize theme BEFORE mount to prevent flash
const themeStore = useThemeStore()
themeStore.init()

app.mount('#app')
