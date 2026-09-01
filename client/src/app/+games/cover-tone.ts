/** 游戏标题首字符（中性占位封面的识别字），无标题时回落 G。 */
export function coverInitial (title: string | null | undefined): string {
  const first = (title || '').trim().charAt(0)
  return first || 'G'
}
