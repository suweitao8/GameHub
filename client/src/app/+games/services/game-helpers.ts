import type { Game, GameList } from '@peertube/peertube-models'

// 将服务端返回的完整 URL coverPath 转换为相对路径（避免跨域 + 走代理）
export function normalizeGame (game: Game): Game {
  if (!game.coverPath || typeof window === 'undefined') return game

  try {
    const coverUrl = new URL(game.coverPath, window.location.origin)
    if (coverUrl.pathname.startsWith('/api/v1/games/')) {
      return { ...game, coverPath: `${coverUrl.pathname}${coverUrl.search}` }
    }
  } catch {
    // Keep the server-provided path if it is not a valid URL.
  }

  return game
}

export function normalizeGameList (result: GameList): GameList {
  return { ...result, data: result.data.map(game => normalizeGame(game)) }
}
