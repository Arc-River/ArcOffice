/**
 * Skills 图标与配色统一管理
 */

const ICONS: Record<string, string> = {
  docx: 'M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 12h8v-2H8v2zm0 4h5v-2H8v2zm0-8h8V6h-4V4H8v6z',
  pdf: 'M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14a2 2 0 0 0 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z',
  pptx: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 9c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2s2 .9 2 2v2c0 1.1-.9 2-2 2zm4 0c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2s2 .9 2 2v2c0 1.1-.9 2-2 2zm-8 0c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2s2 .9 2 2v2c0 1.1-.9 2-2 2z',
  xlsx: 'M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7.53 12L9 10.5l1-1L12 12l3-3 3 3-1 1-2-2-2.53 2zM4 6H2v14a2 2 0 0 0 2 2h14v-2H4V6z',
}

const COLORS: Record<string, string> = {
  docx: '#2B579A',
  pdf: '#C4302B',
  pptx: '#D24726',
  xlsx: '#217346',
}

const DEFAULT_ICON = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z'
const DEFAULT_COLOR = '#5B6E2D'

export function getSkillIcon(name: string): string {
  return ICONS[name.toLowerCase()] || DEFAULT_ICON
}

export function getSkillColor(name: string): string {
  return COLORS[name.toLowerCase()] || DEFAULT_COLOR
}
