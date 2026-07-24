import type { ThemeMode } from '@/types/theme'

/**
 * Synchronously apply theme class to document root.
 * Used in index.html blocking script and Pinia store.
 */
export function applyThemeClass(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'dark') {
    root.classList.add('dark')
  } else if (mode === 'light') {
    root.classList.remove('dark')
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  }
}

/**
 * Persist theme mode to localStorage.
 */
export function persistTheme(mode: ThemeMode) {
  localStorage.setItem('arc-theme', mode)
}
