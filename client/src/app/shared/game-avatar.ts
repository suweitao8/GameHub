/**
 * Generate a deterministic circular pixel-art avatar for users without a profile image.
 * The fallback stays recognizable at both the small header size and the larger developer card size.
 */
export function buildGameAvatarDataUrl (label: string) {
  const text = (label || 'G').trim()
  const seed = Array.from(text).reduce((total, char) => total + char.charCodeAt(0), 0)
  const palettes = [
    { bg: '#e9e8fc', hair: '#26364a', hairDark: '#1a2635', skin: '#f4c9a7', shirt: '#5044e4', shirtAccent: '#352bb0', cheek: '#ef8f8a' },
    { bg: '#fdeaee', hair: '#5a3446', hairDark: '#3d2633', skin: '#f3c4a0', shirt: '#e11d48', shirtAccent: '#9f1239', cheek: '#e98984' },
    { bg: '#dff7ee', hair: '#24534b', hairDark: '#173b36', skin: '#f2c49f', shirt: '#00a878', shirtAccent: '#087255', cheek: '#e78c82' },
    { bg: '#fff0cf', hair: '#4b3a2c', hairDark: '#302319', skin: '#f1c19d', shirt: '#f0a52b', shirtAccent: '#bd6c13', cheek: '#e8887d' }
  ] as const
  const palette = palettes[seed % palettes.length]
  const pixelSize = 4
  const pixel = (x: number, y: number, width: number, height: number, fill: string) =>
    `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${width * pixelSize}" height="${height * pixelSize}" fill="${fill}"/>`

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" shape-rendering="crispEdges">` +
    `<defs><clipPath id="avatar-circle"><circle cx="32" cy="32" r="32"/></clipPath></defs>` +
    `<g clip-path="url(#avatar-circle)">` +
    `<rect width="64" height="64" fill="${palette.bg}"/>` +
    pixel(4, 2, 8, 1, palette.hairDark) +
    pixel(3, 3, 10, 2, palette.hair) +
    pixel(2, 5, 12, 2, palette.hair) +
    pixel(3, 7, 10, 4, palette.skin) +
    pixel(4, 5, 8, 2, palette.skin) +
    pixel(3, 6, 1, 3, palette.hair) +
    pixel(11, 6, 2, 3, palette.hair) +
    pixel(5, 8, 1, 1, palette.hairDark) +
    pixel(10, 8, 1, 1, palette.hairDark) +
    pixel(6, 10, 4, 1, palette.skin) +
    pixel(4, 10, 1, 1, palette.cheek) +
    pixel(11, 10, 1, 1, palette.cheek) +
    pixel(5, 11, 6, 1, palette.skin) +
    pixel(2, 12, 12, 4, palette.shirt) +
    pixel(4, 12, 8, 1, palette.shirtAccent) +
    pixel(6, 13, 4, 1, palette.bg) +
    pixel(7, 14, 2, 2, palette.shirtAccent) +
    `</g><circle cx="32" cy="32" r="31" fill="none" stroke="#ffffff" stroke-opacity="0.68" stroke-width="2"/></svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
