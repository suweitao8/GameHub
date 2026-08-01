import { HttpStatusCode } from '@peertube/peertube-models'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { invalidateRecommendationCache } from '@server/lib/games/game-recommendations.js'
import { awardExp } from '@server/lib/games/game-exp.js'
import { generateGameCoverSignedUrl, generateGameRuntimeSignedUrl } from '@server/lib/games/game-cdn.js'
import { canManageGame, isGameModerator } from '@server/lib/games/game-policy.js'
import { CONFIG } from '@server/initializers/config.js'
import { ROUTE_CACHE_LIFETIME } from '@server/initializers/constants.js'
import { GameModel } from '@server/models/game/game.js'
import { GameStatsSummaryModel } from '@server/models/game/game-stats-summary.js'
import { GameRecentModel } from '@server/models/game/game-recent.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { ActorModel } from '@server/models/actor/actor.js'
import type { MGame } from '@server/types/models/game/game.js'
import { asyncMiddleware, authenticate, gamePlayRateLimiter, optionalAuthenticate, paginationValidator, setDefaultPagination } from '@server/middlewares/index.js'
import { gameListValidator, gameUUIDValidator } from '@server/middlewares/validators/games.js'
import { cacheRoute } from '@server/middlewares/cache/cache.js'
import express from 'express'
import { getUser, formatGame } from './game-shared.js'

const queryRouter = express.Router()

queryRouter.get('/', paginationValidator, setDefaultPagination, gameListValidator, optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_LIST), asyncMiddleware(listGames))
queryRouter.get('/admin', authenticate, asyncMiddleware(listGamesForModerators))
queryRouter.get('/:uuid', gameUUIDValidator, optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_DETAIL), asyncMiddleware(getGame))
queryRouter.get('/:uuid/seo', gameUUIDValidator, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_DETAIL), asyncMiddleware(getGameSEO))
queryRouter.post('/:uuid/play', gameUUIDValidator, gamePlayRateLimiter, optionalAuthenticate, asyncMiddleware(recordPlay))

export { queryRouter }

async function listGames (req: express.Request, res: express.Response) {
  return traceGameOperation('listGames', async () => {
    const start = Math.max(0, Number(req.query.start) || 0)
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 15))
    const following = req.query.view === 'following'
    const user = getUser(res)
    const ownerAccountIds = following
      ? await getFollowedAccountIds(user?.Account?.Actor?.id)
      : undefined

    if (following && !user) return res.json({ total: 0, data: [] })

    const result = await GameModel.listPublished({
      category: req.query.category as string,
      search: req.query.search as string,
      publishedAfter: req.query.publishedAfter as string,
      device: req.query.device as string,
      ownerAccountIds,
      sort: req.query.sort as string,
      limit: count,
      offset: start
    })

    return res.json({ total: result.total, data: result.data.map(formatGame) })
  })
}

async function getFollowedAccountIds (actorId: number | undefined) {
  if (!actorId) return []

  const follows = await ActorFollowModel.findAll({
    where: { actorId, state: 'accepted' },
    attributes: [ 'targetActorId' ],
    raw: true
  })
  const targetActorIds = follows.map(follow => follow.targetActorId)
  if (targetActorIds.length === 0) return []

  const accounts = await ActorModel.findAll({
    where: { id: targetActorIds },
    attributes: [ 'accountId' ],
    raw: true
  })
  return [ ...new Set(accounts.map(account => account.accountId)) ]
}

async function listGamesForModerators (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  if (!user || !isGameModerator(user)) return res.sendStatus(HttpStatusCode.FORBIDDEN_403)

  const data = await GameModel.findAll<MGame>({
    include: [ { model: AccountModel, required: true } ],
    order: [ [ 'createdAt', 'DESC' ] ],
    limit: 100
  })
  return res.json({ total: data.length, data: data.map(formatGame) })
}

async function getGame (req: express.Request, res: express.Response) {
  return traceGameOperation('getGame', async () => {
    const game = await GameModel.loadByUUID(req.params.uuid)
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const user = getUser(res)
    const visible = game.status === 'published' || (user && (canManageGame(game, user) || isGameModerator(user)))
    if (!visible) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    return res.json(formatGame(game))
  })
}

async function recordPlay (req: express.Request, res: express.Response) {
  return traceGameOperation('recordPlay', async () => {
    const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    await GameModel.increment('playCount', { by: 1, where: { id: game.id } })

    const user = getUser(res)
    if (user) {
      await GameRecentModel.upsert({
        gameId: game.id,
        accountId: user.Account.id,
        lastPlayedAt: new Date()
      })
      awardExp(user.Account.id, 'PLAY_GAME').catch(() => undefined)
      invalidateRecommendationCache(user.Account.id).catch(() => undefined)
    }

    return res.json({ runtimeUrl: generateGameRuntimeSignedUrl({ uuid: game.uuid }) })
  })
}

/**
 * 游戏详情页 SEO 元数据 — Open Graph + Twitter Card
 * 供前端 SSR 或 meta 标签注入使用
 */
async function getGameSEO (req: express.Request, res: express.Response) {
  const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const baseUrl = `${CONFIG.WEBSERVER.SCHEME}://${CONFIG.WEBSERVER.HOSTNAME}:${CONFIG.WEBSERVER.PORT}`
  const gameUrl = `${baseUrl}/games/${game.uuid}`
  const coverUrl = game.coverPath
    ? generateGameCoverSignedUrl({ uuid: game.uuid })
    : null

  // Truncate description for social previews (max 200 chars)
  const shortDescription = game.description.length > 200
    ? game.description.slice(0, 197) + '...'
    : game.description

  const owner = (game as any).Owner
  const authorName = owner?.getDisplayName?.() || owner?.name || ''

  const stats = await GameStatsSummaryModel.findOne({ where: { gameId: game.id }, raw: true })

  return res.json({
    url: gameUrl,
    type: 'website',
    title: `${game.title} - GameHub`,
    description: shortDescription,
    siteName: 'GameHub',
    locale: 'zh_CN',
    image: coverUrl,
    imageWidth: 630,
    imageHeight: 1200,
    twitterCard: 'summary_large_image',
    twitterTitle: game.title,
    twitterDescription: shortDescription,
    twitterImage: coverUrl,
    author: authorName,
    category: game.category,
    tags: game.tags,
    stats: stats ? {
      plays: stats.plays,
      likes: stats.likes,
      averageReviewScore: Number(stats.averageReviewScore)
    } : null,
    publishedTime: game.publishedAt?.toISOString() || null,
    modifiedTime: game.updatedAt?.toISOString()
  })
}
