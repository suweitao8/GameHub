export function getGameActionErrorMessage (error: unknown) {
  const response = error as {
    status?: number
    error?: { error?: unknown, code?: unknown, message?: unknown } | string
    message?: unknown
  } | null

  if (response?.status === 401) return '请先登录后再进行这项操作。'
  if (response?.status === 429) return '操作太频繁，请稍后再试。'
  if (response?.status === 413) return '文件过大，请检查文件大小后重试。'
  if (response?.status === 409) return '请求冲突，请检查数据后重试。'

  const payload = typeof response?.error === 'object' && response.error !== null
    ? response.error
    : undefined
  const code = payload?.code
  const message = payload?.error || payload?.message || (typeof response?.error === 'string' ? response.error : response?.message)

  if (code === 'GAME_COIN_BALANCE' || message === '硬币余额不足') return '硬币余额不足。'
  if (message === 'Authors cannot rate their own game' || message === 'Authors cannot coin their own game') {
    return '作者不能对自己的游戏进行这项操作。'
  }
  if (message === 'Cannot follow yourself') return '不能关注自己。'
  if (typeof message === 'string' && message.trim()) return message.endsWith('。') ? message : `${message}。`
  if (response?.status === 403) return '当前账号没有权限进行这项操作。'
  if (response?.status === 404) return '找不到相关内容。'
  return '操作失败，请稍后重试。'
}
