import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ThemeMode } from '@/types/theme'
import { applyThemeClass } from '@/utils/theme'

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('auto')

  /** Resolved effective mode — 'dark' or 'light', never 'auto' */
  const resolved = computed((): Exclude<ThemeMode, 'auto'> => {
    if (mode.value === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return mode.value
  })

  /** Convenient boolean for template conditionals */
  const isDark = computed(() => resolved.value === 'dark')

  function init() {
    const saved = localStorage.getItem('arc-theme') as ThemeMode | null
    mode.value = saved || 'auto'
    applyThemeClass(mode.value)
  }

  function setMode(newMode: ThemeMode) {
    mode.value = newMode
    localStorage.setItem('arc-theme', newMode)
    applyThemeClass(newMode)
    updateMetaThemeColor()
  }

  /**
   * Toggle between dark ↔ light.
   * In 'auto' mode: flips to the opposite of the current system preference.
   * In 'dark'/'light': directly toggles.
   * Calling toggle() from auto then again returns to auto (via light→dark→auto cycle).
   */
  function toggle() {
    if (mode.value === 'dark') {
      setMode('light')
    } else if (mode.value === 'light') {
      // cycle back to auto (follow system)
      setMode('auto')
    } else {
      // auto: flip to opposite of system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setMode(prefersDark ? 'light' : 'dark')
    }
  }

  /**
   * Update the meta theme-color for mobile browsers.
   */
  function updateMetaThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]')
    const color = isDark.value ? '#141414' : '#F2F3F5'
    if (meta) {
      meta.setAttribute('content', color)
    }
  }

  return { mode, resolved, isDark, init, setMode, toggle }
})
