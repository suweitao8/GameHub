import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { getFollowingFeed, getPublicFeed as getPublicGameFeed } from '@server/lib/games/game-feed.js'
import { ROUTE_CACHE_LIFETIME } from '@server/initializers/constants.js'
import { Redis } from '@server/lib/redis.js'
import { GameModel } from '@server/models/game/game.js'
import { GameStatsSummaryModel } from '@server/models/game/game-stats-summary.js'
import { AccountModel } from '@server/models/account/account.js'
import type { MGame } from '@server/types/models/game/game.js'
import { asyncMiddleware, optionalAuthenticate } from '@server/middlewares/index.js'
import { cacheRoute } from '@server/middlewares/cache/cache.js'
import express from 'express'
import { Op } from 'sequelize'
import { getUser, formatGame } from './game-shared.js'

const discoveryRouter = express.Router()

discoveryRouter.get('/feed', optionalAuthenticate, asyncMiddleware(getFeed))
discoveryRouter.get('/feed/public', asyncMiddleware(getPublicFeed))
discoveryRouter.get('/rankings', optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_LIST), asyncMiddleware(getRankings))
discoveryRouter.get('/tags', optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_LIST), asyncMiddleware(listTags))
discoveryRouter.get('/categories', optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_LIST), asyncMiddleware(listCategories))
discoveryRouter.get('/featured', optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_LIST), asyncMiddleware(listFeaturedGames))
discoveryRouter.get('/suggest', cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_LIST), asyncMiddleware(suggestGames))

export { discoveryRouter }

async function getRankings (req: express.Request, res: express.Response) {
  return traceGameOperation('getRankings', async () => {
    const kind = (req.query.kind as string) || 'hot'
    const count = Math.min(100, Math.max(1, Number(req.query.count) || 50))
    const category = req.query.category as string | undefined

    // Map kind to sort metric for listPublished
    const sortMap: Record<string, string> = {
      hot: 'plays',
      newest: 'latest',
      updated: 'updated',
      topRated: 'latest', // We'll sort by averageReviewScore after fetching
      favorites: 'favorites',
      coins: 'coins',
      comments: 'likes', // We'll filter after fetching
      likes: 'likes'
    }

    const sortMetric = sortMap[kind] || 'plays'

    const { data } = await GameModel.listPublished({
      category,
      sort: sortMetric,
      limit: count,
      offset: 0
    })

    // For topRated, sort by averageReviewScore; for comments, include comment count
    const gameIds = data.map(g => g.id)
    const statsMap = new Map<number, any>()
    if (gameIds.length > 0) {
      const statsRows = await GameStatsSummaryModel.findAll({
        where: { gameId: gameIds },
        raw: true
      })
      for (const s of statsRows) statsMap.set(s.gameId, s)
    }

    // Re-sort for special rankings
    let sortedData = data
    if (kind === 'topRated') {
      sortedData = data.sort((a, b) => {
        const scoreA = Number(statsMap.get(a.id)?.averageReviewScore || 0)
        const scoreB = Number(statsMap.get(b.id)?.averageReviewScore || 0)
        return scoreB - scoreA
      })
    } else if (kind === 'comments') {
      sortedData = data.sort((a, b) => {
        const commentsA = Number(statsMap.get(a.id)?.comments || 0)
        const commentsB = Number(statsMap.get(b.id)?.comments || 0)
        return commentsB - commentsA
      })
    }

    const ranked = sortedData.map((game, index) => {
      const formatted = formatGame(game)
      const stats = statsMap.get(game.id)
      return {
        rank: index + 1,
        ...formatted,
        stats: {
          plays: game.playCount,
          likes: Number(stats?.likes || 0),
          favorites: Number(stats?.favorites || 0),
          coins: Number(stats?.coins || 0),
          comments: Number(stats?.comments || 0),
          reviews: Number(stats?.reviews || 0),
          averageReviewScore: Number(stats?.averageReviewScore || 0)
        }
      }
    })

    return res.json({ kind, total: ranked.length, data: ranked })
  })
}

/**
 * 标签聚合 API — 返回所有使用中的标签及其游戏数量
 * 支持 Redis 缓存，TTL 10 分钟
 */
async function listTags (_req: express.Request, res: express.Response) {
  return traceGameOperation('listTags', async () => {
    const cacheKey = 'game-tags-aggregate'
    const client = Redis.Instance.getClient()
    const prefix = Redis.Instance.getPrefix()

    const cached = await client.get(prefix + cacheKey)
    if (cached) {
      return res.json(JSON.parse(cached))
    }

    const { sequelizeTypescript } = await import('@server/initializers/database.js')
    const [ rows ] = await sequelizeTypescript.query(`
      SELECT unnest("tags") AS tag, COUNT(*) AS "gameCount"
      FROM "game"
      WHERE "status" = 'published'
      GROUP BY tag
      ORDER BY "gameCount" DESC
    `, { type: 'SELECT' })

    const tags = (rows as { tag: string; gameCount: string }[]).map(row => ({
      tag: row.tag,
      gameCount: Number(row.gameCount)
    }))

    await client.set(prefix + cacheKey, JSON.stringify(tags), 'PX', 10 * 60 * 1000)

    return res.json(tags)
  })
}

/**
 * 分类聚合 API — 返回所有分类及其游戏数量
 * 支持 Redis 缓存，TTL 10 分钟
 */
async function listCategories (_req: express.Request, res: express.Response) {
  return traceGameOperation('listCategories', async () => {
    const cacheKey = 'game-categories-aggregate'
    const client = Redis.Instance.getClient()
    const prefix = Redis.Instance.getPrefix()

    const cached = await client.get(prefix + cacheKey)
    if (cached) {
      return res.json(JSON.parse(cached))
    }

    const { sequelizeTypescript } = await import('@server/initializers/database.js')
    const [ rows ] = await sequelizeTypescript.query(`
      SELECT "category", COUNT(*) AS "gameCount"
      FROM "game"
      WHERE "status" = 'published'
      GROUP BY "category"
      ORDER BY "gameCount" DESC
    `, { type: 'SELECT' })

    const categories = (rows as { category: string; gameCount: string }[]).map(row => ({
      category: row.category,
      gameCount: Number(row.gameCount)
    }))

    await client.set(prefix + cacheKey, JSON.stringify(categories), 'PX', 10 * 60 * 1000)

    return res.json(categories)
  })
}

/**
 * 精选游戏列表 — 返回管理员标记为 featured 的游戏
 * 按 featuredAt 降序排列（最新精选的排前面）
 */
async function listFeaturedGames (req: express.Request, res: express.Response) {
  return traceGameOperation('listFeaturedGames', async () => {
    const count = Math.min(20, Math.max(1, Number(req.query.count) || 10))
    const category = req.query.category as string | undefined

    const where: any = { status: 'published', featured: true }
    if (category) where.category = category

    const data = await GameModel.findAll<MGame>({
      subQuery: false,
      where,
      attributes: { include: GameModel.getPublicStatsAttributes() },
      include: [
        { model: AccountModel, required: true },
        { model: GameStatsSummaryModel, required: false }
      ],
      order: [ [ 'featuredAt', 'DESC' ], [ 'playCount', 'DESC' ] ],
      limit: count
    })

    return res.json({ total: data.length, data: data.map(formatGame) })
  })
}

/**
 * 搜索建议：根据输入前缀返回匹配的游戏标题和标签
 * 用于顶部搜索框自动补全
 */
async function suggestGames (req: express.Request, res: express.Response) {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (q.length < 2) return res.json({ data: [] })

  const limit = Math.min(20, Math.max(1, Number(req.query.count) || 8))
  const like = `%${q}%`
  const ilike = { [Op.iLike]: like }

  const [ titles, tags ] = await Promise.all([
    GameModel.findAll<MGame>({
      where: { status: 'published', title: ilike },
      attributes: [ 'title' ],
      order: [ [ 'playCount', 'DESC' ] ],
      limit: limit * 2
    }),
    GameModel.findAll<MGame>({
      where: { status: 'published', tags: { [Op.overlap]: [ q ] } },
      attributes: [ 'tags' ],
      limit: limit * 2
    })
  ])

  const results = new Set<string>()
  titles.forEach(g => results.add(g.title))
  tags.forEach(g => {
    (g.tags || []).forEach((tag: string) => {
      if (tag.toLowerCase().includes(q.toLowerCase())) results.add(tag)
    })
  })

  // Fallback to category match
  const categoryMap: Record<string, string> = {
    '动作': 'arcade', '冒险': 'adventure', '射击': 'shooter',
    '解谜': 'puzzle', '休闲': 'casual', '角色': 'rpg',
    '策略': 'strategy', '模拟': 'simulation', '沙盒': 'sandbox',
    '竞速': 'racing', '体育': 'sports', '卡牌': 'card',
    '音乐': 'music', '恐怖': 'horror', '桌游': 'board'
  }
  Object.entries(categoryMap).forEach(([ label, key ]) => {
    if (label.includes(q) || q.includes(label)) results.add(label)
  })

  const data = Array.from(results).slice(0, limit)
  return res.json({ data })
}

/**
 * 关注动态 Feed
 */
async function getFeed (req: express.Request, res: express.Response) {
  return traceGameOperation('getFeed', async () => {
    const user = getUser(res)
    const start = Math.max(0, Number(req.query.start) || 0)
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 20))

    if (!user) return res.json({ total: 0, data: [] })

    const result = await getFollowingFeed(user.Account.id, { limit: count, offset: start })
    return res.json(result)
  })
}

/**
 * 公开动态 Feed
 */
async function getPublicFeed (req: express.Request, res: express.Response) {
  return traceGameOperation('getPublicFeed', async () => {
    const start = Math.max(0, Number(req.query.start) || 0)
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 20))

    const result = await getPublicGameFeed({ limit: count, offset: start })
    return res.json(result)
  })
}
