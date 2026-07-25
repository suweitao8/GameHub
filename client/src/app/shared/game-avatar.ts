/**
 * Generate a smooth circular avatar data URL with initials.
 * Avoid pixel-art / crispEdges SVGs that look crooked when scaled up on game pages.
 */
export function buildGameAvatarDataUrl (label: string) {
  const text = (label || 'G').trim()
  const seed = Array.from(text).reduce((total, char) => total + char.charCodeAt(0), 0)
  const palettes = [
    { bg: '#e5f7ff', fg: '#008acb', ring: '#00aeec' },
    { bg: '#fff0f5', fg: '#c44a72', ring: '#fb7299' },
    { bg: '#e7fff8', fg: '#0f8a68', ring: '#00c091' },
    { bg: '#fff7e8', fg: '#a67a00', ring: '#ffb400' }
  ] as const
  const palette = palettes[seed % palettes.length]

  const first = text[0] || 'G'
  const initial = /[\u4e00-\u9fffA-Za-z0-9]/.test(first) ? first.toUpperCase() : 'G'

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">` +
    `<circle cx="32" cy="32" r="32" fill="${palette.bg}"/>` +
    `<circle cx="32" cy="32" r="30" fill="none" stroke="${palette.ring}" stroke-width="2" opacity="0.35"/>` +
    `<text x="32" y="34" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="28" font-weight="700" fill="${palette.fg}">` +
    `${escapeXml(initial)}</text></svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function escapeXml (value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
