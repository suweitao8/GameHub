/**
 * 封面多彩色板选择器：B 站式封面墙的确定性取色。
 *
 * 没有自定义封面的游戏按 uuid/title 哈希从 tokens 里的 10 组
 * .cover-tone-N 渐变色板中取一组，保证同一游戏永远同色、
 * 不同游戏色彩分散，让列表像 B 站封面墙一样多彩而非一片单色。
 */
export const COVER_TONE_COUNT = 10

export function coverToneIndex (seed: string): number {
  let hash = 0
  const source = seed || 'GameHub'
  for (let i = 0; i < source.length; i++) {
    hash = ((hash * 31) + source.charCodeAt(i)) >>> 0
  }

  return hash % COVER_TONE_COUNT
}

export function coverToneClass (seed: string): string {
  return 'cover-tone-' + coverToneIndex(seed)
}

/** 游戏标题首字符（占位封面的大水印字），无标题时回落 G。 */
export function coverInitial (title: string | null | undefined): string {
  const first = (title || '').trim().charAt(0)
  return first || 'G'
}
