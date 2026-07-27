/**
 * Format file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${units[i]}`
}

/**
 * Format date to locale string.
 */
export function formatDate(date: Date | string | number, locale: string = 'zh-CN'): string {
  const d = typeof date === 'object' ? date : new Date(date)
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * Format duration in milliseconds to human-readable string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

/**
 * Format a date string (from DB) into a human-friendly relative time.
 * Handles UTC timestamps (CURRENT_TIMESTAMP) by appending 'Z'.
 */
export function formatRelativeTime(dateStr: string, locale: string = 'zh-CN'): string {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return locale === 'en' ? 'just now' : '刚刚'
  if (minutes < 60) return locale === 'en' ? `${minutes}m ago` : `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return locale === 'en' ? `${hours}h ago` : `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return locale === 'en' ? `${days}d ago` : `${days}天前`
  return new Date(dateStr).toLocaleDateString(locale)
}

/**
 * Smart date formatting for file listings.
 * Shows relative time for recent dates, locale date for older ones.
 */
export function formatSmartDate(mtime: string, locale: string = 'zh-CN'): string {
  if (!mtime) return ''
  const d = new Date(mtime)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return locale === 'en' ? 'yesterday' : '昨天'
  if (days < 7) return locale === 'en' ? `${days}d ago` : `${days}天前`
  return d.toLocaleDateString(locale)
}
