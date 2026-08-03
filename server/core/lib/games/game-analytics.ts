import { sequelizeTypescript } from '@server/initializers/database.js'
import { Redis } from '@server/lib/redis.js'

const ANALYTICS_CACHE_PREFIX = 'game-analytics:v2:'
const ANALYTICS_CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

export type GameAnalyticsRange = '7d' | '30d' | '90d'

function getAnalyticsDays (range: GameAnalyticsRange): number {
  if (range === '7d') return 7
  if (range === '90d') return 90
  return 30
}

/**
 * 获取创作者所有游戏的播放趋势（按天聚合）
 */
export async function getCreatorPlayTrend (accountId: number, range: GameAnalyticsRange = '30d'): Promise<{ date: string; plays: number }[]> {
  const days = getAnalyticsDays(range)
  const cacheKey = `${ANALYTICS_CACHE_PREFIX}play-trend:${accountId}:${days}`
  const client = Redis.Instance.getClient()
  const prefix = Redis.Instance.getPrefix()

  const cached = await client.get(prefix + cacheKey)
  if (cached) return JSON.parse(cached)

  const rows = await sequelizeTypescript.query(`
    SELECT
      DATE("recent"."lastPlayedAt") AS date,
      COUNT(*) AS plays
    FROM "gameRecent" recent
    INNER JOIN "game" g ON g.id = recent."gameId" AND g."ownerAccountId" = :accountId
    WHERE "recent"."lastPlayedAt" >= NOW() - INTERVAL '${days} days'
    GROUP BY DATE("recent"."lastPlayedAt")
    ORDER BY date ASC
  `, {
    replacements: { accountId },
    type: 'SELECT'
  })

  const result = (rows as { date: string; plays: string }[]).map(row => ({
    date: row.date,
    plays: Number(row.plays)
  }))

  await client.set(prefix + cacheKey, JSON.stringify(result), 'PX', ANALYTICS_CACHE_TTL_MS)
  return result
}

/**
 * 获取创作者所有游戏的互动分布（点赞/投币/收藏/评论数）
 */
export async function getCreatorInteractionBreakdown (accountId: number): Promise<{
  likes: number
  coins: number
  favorites: number
  comments: number
}> {
  const cacheKey = `${ANALYTICS_CACHE_PREFIX}interaction-breakdown:${accountId}`
  const client = Redis.Instance.getClient()
  const prefix = Redis.Instance.getPrefix()

  const cached = await client.get(prefix + cacheKey)
  if (cached) return JSON.parse(cached)

  const gameIds = await sequelizeTypescript.query(`
    SELECT id FROM "game" WHERE "ownerAccountId" = :accountId
  `, {
    replacements: { accountId },
    type: 'SELECT'
  }).then(rows => (rows as { id: number }[]).map(r => r.id))

  if (gameIds.length === 0) {
    const empty = { likes: 0, coins: 0, favorites: 0, comments: 0 }
    await client.set(prefix + cacheKey, JSON.stringify(empty), 'PX', ANALYTICS_CACHE_TTL_MS)
    return empty
  }

  const [ likes, coins, favorites, comments ] = await Promise.all([
    sequelizeTypescript.query(`
      SELECT COUNT(*) AS cnt FROM "gameRating" WHERE "gameId" IN (:gameIds) AND type = 'like'
    `, { replacements: { gameIds }, type: 'SELECT' }),
    sequelizeTypescript.query(`
      SELECT COALESCE(SUM("amount" * -1), 0) AS cnt FROM "gameCoinLedger"
      WHERE "gameId" IN (:gameIds) AND kind = 'spend'
    `, { replacements: { gameIds }, type: 'SELECT' }),
    sequelizeTypescript.query(`
      SELECT COUNT(*) AS cnt FROM "gameFavorite" WHERE "gameId" IN (:gameIds)
    `, { replacements: { gameIds }, type: 'SELECT' }),
    sequelizeTypescript.query(`
      SELECT COUNT(*) AS cnt FROM "gameComment" WHERE "gameId" IN (:gameIds) AND "deletedAt" IS NULL
    `, { replacements: { gameIds }, type: 'SELECT' }),
  ])

  const result = {
    likes: Number((likes[0] as any)?.cnt || 0),
    coins: Math.max(0, Number((coins[0] as any)?.cnt || 0)),
    favorites: Number((favorites[0] as any)?.cnt || 0),
    comments: Number((comments[0] as any)?.cnt || 0)
  }

  await client.set(prefix + cacheKey, JSON.stringify(result), 'PX', ANALYTICS_CACHE_TTL_MS)
  return result
}

/**
 * 获取创作者各游戏的排行数据（按播放量排序）
 */
export async function getCreatorGameRanking (accountId: number): Promise<{
  gameId: number
  title: string
  plays: number
  likes: number
  coins: number
}[]> {
  const cacheKey = `${ANALYTICS_CACHE_PREFIX}game-ranking:${accountId}`
  const client = Redis.Instance.getClient()
  const prefix = Redis.Instance.getPrefix()

  const cached = await client.get(prefix + cacheKey)
  if (cached) return JSON.parse(cached)

  const rows = await sequelizeTypescript.query(`
    SELECT
      g.id AS "gameId",
      g.title,
      g."playCount" AS plays,
      COALESCE(s.likes, 0) AS likes,
      COALESCE(s.coins, 0) AS coins
    FROM "game" g
    LEFT JOIN "gameStatsSummary" s ON s."gameId" = g.id
    WHERE g."ownerAccountId" = :accountId
    ORDER BY g."playCount" DESC
    LIMIT 20
  `, {
    replacements: { accountId },
    type: 'SELECT'
  })

  const result = (rows as any[]).map(row => ({
    gameId: Number(row.gameId),
    title: row.title,
    plays: Number(row.plays),
    likes: Number(row.likes),
    coins: Number(row.coins)
  }))

  await client.set(prefix + cacheKey, JSON.stringify(result), 'PX', ANALYTICS_CACHE_TTL_MS)
  return result
}

/**
 * 获取创作者粉丝增长趋势
 */
export async function getCreatorFollowerTrend (accountId: number, range: GameAnalyticsRange = '30d'): Promise<{ date: string; followers: number }[]> {
  const days = getAnalyticsDays(range)
  const cacheKey = `${ANALYTICS_CACHE_PREFIX}follower-trend:${accountId}:${days}`
  const client = Redis.Instance.getClient()
  const prefix = Redis.Instance.getPrefix()

  const cached = await client.get(prefix + cacheKey)
  if (cached) return JSON.parse(cached)

  const rows = await sequelizeTypescript.query(`
    SELECT
      DATE("actorFollow"."createdAt") AS date,
      COUNT(*) AS followers
    FROM "actorFollow"
    INNER JOIN "actor" ON "actor"."id" = "actorFollow"."targetActorId"
    WHERE "actor"."accountId" = :accountId
      AND "actorFollow"."state" = 'accepted'
      AND "actorFollow"."createdAt" >= NOW() - INTERVAL '${days} days'
    GROUP BY DATE("actorFollow"."createdAt")
    ORDER BY date ASC
  `, {
    replacements: { accountId },
    type: 'SELECT'
  })

  const result = (rows as { date: string; followers: string }[]).map(row => ({
    date: row.date,
    followers: Number(row.followers)
  }))

  await client.set(prefix + cacheKey, JSON.stringify(result), 'PX', ANALYTICS_CACHE_TTL_MS)
  return result
}
