export function buildGameAvatarDataUrl (label: string) {
  const seed = Array.from(label || 'G').reduce((total, char) => total + char.charCodeAt(0), 0)
  const palettes = [
    [ '#00aeec', '#e5f7ff', '#18191c' ],
    [ '#fb7299', '#fff0f5', '#6d203f' ],
    [ '#00c091', '#e7fff8', '#145847' ],
    [ '#ffb400', '#fff7dc', '#6b4b00' ]
  ]
  const [ primary, soft, dark ] = palettes[seed % palettes.length]
  const cells = Array.from({ length: 16 }, (_, index) => {
    const row = Math.floor(index / 4)
    const column = index % 4
    const active = ((seed >> (index % 8)) & 1) === 1 || row === column
    if (!active) return ''

    const mirroredColumn = column < 2 ? column : 3 - column
    return `<rect x="${1 + mirroredColumn}" y="${1 + row}" width="1" height="1" fill="${index % 3 === 0 ? dark : primary}"/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6 6" shape-rendering="crispEdges"><rect width="6" height="6" rx="1" fill="${soft}"/><rect x="1" y="1" width="4" height="4" fill="#fff"/>${cells}<rect x="2" y="4.25" width="1" height="0.5" fill="${dark}"/><rect x="3" y="4.25" width="1" height="0.5" fill="${dark}"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
