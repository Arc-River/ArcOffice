import { createI18n } from 'vue-i18n'
import en from './locales/en'
import zhCN from './locales/zh-CN'

const savedLocale = typeof localStorage !== 'undefined' ? localStorage.getItem('arc-locale') : null

const i18n = createI18n({
  legacy: false,
  locale: savedLocale || 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    en: en,
  },
})

export default i18n
