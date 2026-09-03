/**
 * Build a stable, lightweight cover for games that do not have an uploaded image.
 * The SVG is intentionally flat and restrained so it reads as a content thumbnail,
 * not as a second visual theme. It remains the synchronous last-resort fallback
 * when the category preset image cannot be loaded.
 */

export const GAME_COVER_PRESET_CATEGORIES = [
  'arcade', 'adventure', 'shooter', 'puzzle', 'casual', 'rpg', 'strategy', 'simulation',
  'sandbox', 'racing', 'sports', 'card', 'music', 'horror', 'board', 'other'
] as const

export type GameCoverPresetCategory = typeof GAME_COVER_PRESET_CATEGORIES[number]

/**
 * Resolve a category to a bundled 16:9 background. Keeping this mapping pure
 * means every display surface and the upload generator share the same asset.
 */
export function getGameCoverPresetUrl (category = 'other') {
  const normalized = category.trim().toLowerCase()
  const preset = GAME_COVER_PRESET_CATEGORIES.includes(normalized as GameCoverPresetCategory)
    ? normalized
    : 'other'

  return '/client/assets/images/game-cover-presets/' + preset + '.jpg'
}

const CATEGORY_LABELS: Record<string, string> = {
  arcade: '动作', adventure: '冒险', shooter: '射击', puzzle: '解谜', casual: '休闲', rpg: '角色扮演', strategy: '策略',
  simulation: '模拟', sandbox: '沙盒', racing: '竞速', sports: '体育', card: '卡牌', music: '音乐', horror: '恐怖', board: '桌游', other: '小游戏'
}

const PALETTES = [
  { background: '#edf3f5', panel: '#dbe7eb', accent: '#007ea7', ink: '#19333e', muted: '#60747c', line: '#b4cbd2' },
  { background: '#f1f1f0', panel: '#e0e2df', accent: '#5c6f76', ink: '#283438', muted: '#687477', line: '#c1c9c8' },
  { background: '#f3f0ec', panel: '#e8ded0', accent: '#9b6d3c', ink: '#3c3027', muted: '#81756d', line: '#d1bda5' },
  { background: '#f0f1f4', panel: '#dfe2e9', accent: '#5d6d9d', ink: '#252d42', muted: '#68718a', line: '#c0c7da' },
  { background: '#eef2ee', panel: '#dce7df', accent: '#4f7b68', ink: '#24372e', muted: '#68786f', line: '#bfd1c5' }
] as const

function hashText (value: string) {
  let hash = 2166136261
  for (const character of Array.from(value)) {
    hash ^= character.codePointAt(0) || 0
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function escapeXml (value: string) {
  const escapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
  return value.replace(/[&<>"']/g, character => escapes[character])
}

function normalizeTitle (title: string) {
  return title.replace(/\s+/g, ' ').trim() || '未命名游戏'
}

function splitTitle (title: string) {
  const characters = Array.from(title)
  if (characters.length <= 14) return [ title ]

  const firstLine = characters.slice(0, 14).join('').trim()
  const secondLine = characters.slice(14, 28).join('').trim()
  return [ firstLine, `${secondLine}${characters.length > 28 ? '…' : ''}` ]
}

function buildMotif (variant: number, palette: typeof PALETTES[number]) {
  const motifs = [
    `<circle cx="520" cy="92" r="112" fill="${palette.panel}"/>` +
      `<circle cx="520" cy="92" r="68" fill="none" stroke="${palette.accent}" stroke-width="18" opacity=".22"/>` +
      `<path d="M420 264h150v18H420z" fill="${palette.accent}" opacity=".28"/>`,
    `<rect x="428" y="54" width="146" height="146" fill="${palette.panel}"/>` +
      `<rect x="464" y="90" width="146" height="146" fill="${palette.accent}" opacity=".16"/>` +
      `<path d="M428 244 610 62" stroke="${palette.accent}" stroke-width="18" opacity=".28"/>`,
    `<path d="M436 194c0-78 50-128 128-128v128z" fill="${palette.panel}"/>` +
      `<path d="M500 248c0-58 38-96 96-96v96z" fill="${palette.accent}" opacity=".22"/>` +
      `<circle cx="454" cy="76" r="12" fill="${palette.accent}"/>`,
    `<path d="M432 68h158v158H432z" fill="${palette.panel}"/>` +
      `<path d="M432 68h158v26H432zM432 200h158v26H432z" fill="${palette.accent}" opacity=".22"/>` +
      `<circle cx="511" cy="147" r="42" fill="none" stroke="${palette.accent}" stroke-width="16" opacity=".28"/>`
  ]
  return motifs[variant % motifs.length]
}

/**
 * Compute a compact average color from RGBA pixels returned by a canvas.
 * Transparent pixels are ignored so image padding does not tint the result.
 */
export function averageColorFromPixels (pixels: ArrayLike<number>) {
  let red = 0
  let green = 0
  let blue = 0
  let alphaTotal = 0

  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255
    if (alpha <= 0) continue

    red += pixels[index] * alpha
    green += pixels[index + 1] * alpha
    blue += pixels[index + 2] * alpha
    alphaTotal += alpha
  }

  if (!alphaTotal) return '#c3dce5'

  return `#${[ red, green, blue ]
    .map(value => Math.round(value / alphaTotal).toString(16).padStart(2, '0'))
    .join('')}`
}

/** Pick the higher-contrast foreground for a solid-color information bar. */
export function getReadableTextColor (hexColor: string) {
  const match = /^#([\da-f]{6})$/i.exec(hexColor)
  if (!match) return '#18191c'

  const [ red, green, blue ] = [ 0, 2, 4 ].map(offset => Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255)
  const toLinear = (channel: number) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  const luminance = 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)

  return luminance > 0.179 ? '#18191c' : '#ffffff'
}

/**
 * Generate a deterministic SVG data URL from a game title and category.
 * Keeping this pure makes it safe to use in Angular templates, tests, and
 * upload previews without a network request or an AI service.
 */
export function buildGameCoverDataUrl (title: string, category = 'other') {
  const normalizedTitle = normalizeTitle(title)
  const normalizedCategory = category.trim().toLowerCase() || 'other'
  const seed = hashText(`${normalizedTitle}\u0000${normalizedCategory}`)
  const palette = PALETTES[seed % PALETTES.length]
  const categoryLabel = CATEGORY_LABELS[normalizedCategory] || '小游戏'
  const titleLines = splitTitle(normalizedTitle)
  const titleMarkup = titleLines
    .map((line, index) => [
      `<text x="40" y="${144 + index * 46}" fill="${palette.ink}"`,
      ' font-family="Microsoft YaHei,Segoe UI,Arial,sans-serif" font-size="42" font-weight="800">',
      `${escapeXml(line)}</text>`
    ].join(''))
    .join('')
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">',
    `<rect width="640" height="360" fill="${palette.background}"/>`,
    `<rect width="640" height="10" fill="${palette.accent}"/>`,
    `<rect x="32" y="34" width="576" height="292" rx="18" fill="${palette.panel}" opacity=".42"/>`,
    buildMotif(seed % 4, palette),
    `<text x="40" y="72" fill="${palette.accent}" font-family="Segoe UI,Arial,sans-serif"` +
      ` font-size="14" font-weight="800" letter-spacing="2">GAMEHUB / ${escapeXml(categoryLabel)}</text>`,
    `<line x1="40" y1="112" x2="336" y2="112" stroke="${palette.line}" stroke-width="2"/>`,
    titleMarkup,
    `<rect x="552" y="42" width="48" height="48" rx="12" fill="${palette.accent}"/>`,
    `<text x="576" y="74" fill="#ffffff" font-family="Segoe UI,Arial,sans-serif"` +
      ' font-size="24" font-weight="800" text-anchor="middle">G</text>',
    '</svg>'
  ].join('')

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
