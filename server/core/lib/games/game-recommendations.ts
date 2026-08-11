import { Op } from 'sequelize'
import { AccountModel } from '@server/models/account/account.js'
import { GameFavoriteModel } from '@server/models/game/game-favorite.js'
import { GameRatingModel } from '@server/models/game/game-rating.js'
import { GameCoinLedgerModel } from '@server/models/game/game-coin-ledger.js'
import { GameRecentModel } from '@server/models/game/game-recent.js'
import { GameStatsSummaryModel } from '@server/models/game/game-stats-summary.js'
import { GameModel } from '@server/models/game/game.js'
import type { MGame } from '@server/types/models/game/game.js'
import { Redis } from '@server/lib/redis.js'

const RECOMMENDATION_CACHE_PREFIX = 'game-rec:'
const RECOMMENDATION_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const INTERACTION_CACHE_PREFIX = 'game-interact:'
const INTERACTION_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Build user interaction vector from explicit signals:
 * - play = 1, favorite = 3, like = 2, coin = 4
 * These weights reflect stronger intent for heavier actions.
 * Results are cached in Redis for 10 minutes.
 */
async function getUserInteractions (accountId: number): Promise<Map<number, number>> {
  const cacheKey = `${INTERACTION_CACHE_PREFIX}${accountId}`
  const client = Redis.Instance.getClient()
  const prefix = Redis.Instance.getPrefix()

  const cached = await client.get(prefix + cacheKey)
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as [number, number][]
      return new Map(parsed)
    } catch { /* fall through to compute */ }
  }

  const [ favorites, ratings, coins, recents ] = await Promise.all([
    GameFavoriteModel.findAll({ where: { accountId }, attributes: [ 'gameId' ], raw: true }),
    // 仅统计 like，避免 dislike 被当作正反馈污染协同过滤向量
    GameRatingModel.findAll({ where: { accountId, type: 'like' }, attributes: [ 'gameId' ], raw: true }),
    GameCoinLedgerModel.findAll({ where: { accountId, kind: 'spend' }, attributes: [ 'gameId' ], raw: true }),
    GameRecentModel.findAll({ where: { accountId }, attributes: [ 'gameId' ], raw: true })
  ])

  const interactions = new Map<number, number>()

  for (const item of recents) interactions.set(item.gameId, (interactions.get(item.gameId) || 0) + 1)
  for (const item of favorites) interactions.set(item.gameId, (interactions.get(item.gameId) || 0) + 3)
  for (const item of ratings) interactions.set(item.gameId, (interactions.get(item.gameId) || 0) + 2)
  for (const item of coins) interactions.set(item.gameId, (interactions.get(item.gameId) || 0) + 4)

  // Cache as array of [gameId, weight] pairs
  const serializable = [ ...interactions.entries() ]
  await client.set(prefix + cacheKey, JSON.stringify(serializable), 'PX', INTERACTION_CACHE_TTL_MS)

  return interactions
}

/**
 * Compute cosine similarity between two user interaction vectors.
 * Returns a value between -1 and 1.
 */
function cosineSimilarity (a: Map<number, number>, b: Map<number, number>): number {
  const allGames = new Set([ ...a.keys(), ...b.keys() ])
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (const gameId of allGames) {
    const va = a.get(gameId) || 0
    const vb = b.get(gameId) || 0
    dotProduct += va * vb
    normA += va * va
    normB += vb * vb
  }

  if (normA === 0 || normB === 0) return 0

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Find top-K similar users based on interaction overlap.
 */
async function findSimilarUsers (accountId: number, k: number): Promise<{ accountId: number; similarity: number }[]> {
  const targetVector = await getUserInteractions(accountId)
  if (targetVector.size === 0) return []

  // Find other users who have interacted with any of the same games
  const gameIds = [ ...targetVector.keys() ]
  const [ favorites, ratings, coins, recents ] = await Promise.all([
    GameFavoriteModel.findAll({ where: { gameId: gameIds, accountId: { [Op.ne]: accountId } }, attributes: [ 'accountId' ], raw: true }),
    GameRatingModel.findAll({ where: { gameId: gameIds, accountId: { [Op.ne]: accountId }, type: 'like' }, attributes: [ 'accountId' ], raw: true }),
    GameCoinLedgerModel.findAll({ where: { gameId: gameIds, accountId: { [Op.ne]: accountId }, kind: 'spend' }, attributes: [ 'accountId' ], raw: true }),
    GameRecentModel.findAll({ where: { gameId: gameIds, accountId: { [Op.ne]: accountId } }, attributes: [ 'accountId' ], raw: true })
  ])

  const otherAccountIds = new Set<number>()
  for (const item of [ ...favorites, ...ratings, ...coins, ...recents ]) {
    otherAccountIds.add(item.accountId)
  }

  if (otherAccountIds.size === 0) return []

  const similarities: { accountId: number; similarity: number }[] = []

  for (const otherId of otherAccountIds) {
    const otherVector = await getUserInteractions(otherId)
    const similarity = cosineSimilarity(targetVector, otherVector)
    if (similarity > 0) {
      similarities.push({ accountId: otherId, similarity })
    }
  }

  similarities.sort((a, b) => b.similarity - a.similarity)

  return similarities.slice(0, k)
}

/**
 * Recommend games for a user based on collaborative filtering.
 * Returns top N game IDs with scores.
 * Results are cached in Redis for 5 minutes.
 */
export async function recommendGamesForUser (options: {
  accountId: number
  limit?: number
  excludeGameIds?: number[]
}): Promise<{ gameId: number; score: number }[]> {
  const { accountId, limit = 20, excludeGameIds = [] } = options

  const cacheKey = `${RECOMMENDATION_CACHE_PREFIX}${accountId}:${limit}`
  const client = Redis.Instance.getClient()
  const prefix = Redis.Instance.getPrefix()

  const cached = await client.get(prefix + cacheKey)
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { gameId: number; score: number }[]
      if (excludeGameIds.length === 0) return parsed.slice(0, limit)
      return parsed.filter(r => !excludeGameIds.includes(r.gameId)).slice(0, limit)
    } catch { /* fall through to compute */ }
  }

  const similarUsers = await findSimilarUsers(accountId, 10)
  if (similarUsers.length === 0) return []

  const userInteractions = await getUserInteractions(accountId)
  const scores = new Map<number, number>()

  for (const { accountId: similarId, similarity } of similarUsers) {
    const similarInteractions = await getUserInteractions(similarId)
    for (const [ gameId, weight ] of similarInteractions) {
      if (userInteractions.has(gameId)) continue // Already interacted
      if (excludeGameIds.includes(gameId)) continue

      scores.set(gameId, (scores.get(gameId) || 0) + weight * similarity)
    }
  }

  const results = [ ...scores.entries() ]
    .map(([ gameId, score ]) => ({ gameId, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  // Cache the full result (without excludeGameIds filtering)
  await client.set(prefix + cacheKey, JSON.stringify(results), 'PX', RECOMMENDATION_CACHE_TTL_MS)

  return results
}

/**
 * Get recommended games for a user with full game objects.
 */
export async function getRecommendedGames (options: {
  accountId: number
  limit?: number
}): Promise<{ total: number; data: MGame[] }> {
  const { accountId, limit = 20 } = options

  const recommendations = await recommendGamesForUser({ accountId, limit })
  if (recommendations.length === 0) return { total: 0, data: [] }

  const gameIds = recommendations.map(r => r.gameId)
  const games = await GameModel.findAll<MGame>({
    where: { id: gameIds, status: 'published' },
    include: [
      { model: AccountModel, required: true },
      { model: GameStatsSummaryModel, required: false }
    ],
    attributes: { include: GameModel.getPublicStatsAttributes() }
  })

  const gameMap = new Map(games.map(g => [ g.id, g ]))
  const orderedGames = recommendations
    .map(r => gameMap.get(r.gameId))
    .filter((g): g is MGame => g !== undefined)

  return { total: orderedGames.length, data: orderedGames }
}

/**
 * Invalidate recommendation and interaction caches for a user.
 * Call this when the user performs a new interaction (like, favorite, coin, play).
 */
export async function invalidateRecommendationCache (accountId: number): Promise<void> {
  const client = Redis.Instance.getClient()
  const prefix = Redis.Instance.getPrefix()

  // Delete interaction cache
  await client.del(prefix + `${INTERACTION_CACHE_PREFIX}${accountId}`)

  // Delete all recommendation caches for this user (different limit values)
  // Use SCAN to find matching keys
  let cursor = '0'
  const pattern = prefix + `${RECOMMENDATION_CACHE_PREFIX}${accountId}:*`
  do {
    const reply = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
    cursor = reply[0]
    const keys = reply[1]
    if (keys.length > 0) await client.del(keys)
  } while (cursor !== '0')
}
