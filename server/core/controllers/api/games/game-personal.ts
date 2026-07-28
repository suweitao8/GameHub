import { HttpStatusCode } from '@peertube/peertube-models'
import { GameAuditView, auditLoggerFactory, getAuditIdFromRes } from '@server/helpers/audit-logger.js'
import { cleanUpReqFiles, createReqFiles } from '@server/helpers/express-utils.js'
import { sanitizeGameDescription } from '@server/helpers/game-sanitization.js'
import { generateGameCoverSignedUrl, generateGameRuntimeSignedUrl } from '@server/lib/games/game-cdn.js'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { getRecommendedGames, invalidateRecommendationCache } from '@server/lib/games/game-recommendations.js'
import { getCreatorPlayTrend, getCreatorInteractionBreakdown, getCreatorGameRanking, getCreatorFollowerTrend } from '@server/lib/games/game-analytics.js'
import { awardExp, claimDailyLogin, getUserLevelInfo } from '@server/lib/games/game-exp.js'
import { getFollowingFeed, getPublicFeed as getPublicGameFeed } from '@server/lib/games/game-feed.js'
import { createGameShareToken, resolveGameShareToken } from '@server/lib/games/game-share.js'
import { GameRuntimeValidationError, MAX_SCREENSHOTS, readStoredGameHtml, storeGameCover, storeGameRuntimePackage, storeGameScreenshot } from '@server/lib/games/game-runtime.js'
import { createGameRuntimePreview } from '@server/lib/games/game-runtime-preview.js'
import { createGameNotification } from '@server/lib/games/game-notifications.js'
import { canManageGame, getModerationStatus, isGameModerator } from '@server/lib/games/game-policy.js'
import { CONFIG } from '@server/initializers/config.js'
import { ROUTE_CACHE_LIFETIME } from '@server/initializers/constants.js'
import { Redis } from '@server/lib/redis.js'
import { GameModel } from '@server/models/game/game.js'
import { GameStatsSummaryModel } from '@server/models/game/game-stats-summary.js'
import { GameCollectionModel, GameCollectionItemModel } from '@server/models/game/game-collection.js'
import { GameReserveModel } from '@server/models/game/game-reserve.js'
import { GameFavoriteModel } from '@server/models/game/game-favorite.js'
import { GameRecentModel } from '@server/models/game/game-recent.js'
import { GameCoinLedgerModel } from '@server/models/game/game-coin-ledger.js'
import { GameNotificationModel } from '@server/models/game/game-notification.js'
import { GameReportModel } from '@server/models/game/game-report.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { GameActivityModel } from '@server/models/game/game-activity.js'
import type { MGame } from '@server/types/models/game/game.js'
import { apiRateLimiter, asyncMiddleware, authenticate, gamePlayRateLimiter, gameUploadRateLimiter, optionalAuthenticate, paginationValidator, setDefaultPagination } from '@server/middlewares/index.js'
import { gameCreateValidator, gameListValidator, gameModerationValidator, gameUUIDValidator, parseGameTags } from '@server/middlewares/validators/games.js'
import { cacheRoute } from '@server/middlewares/cache/cache.js'
import { readFile, rm } from 'fs/promises'
import express from 'express'
import { literal, Op } from 'sequelize'
import { gameFile, gameFileUpload, MAX_GAMES_PER_ACCOUNT, gamesAuditLogger, getUser, formatGame, formatGameTags, formatGameNotification } from './game-shared.js'
import express from 'express'

const personalRouter = express.Router()

personalRouter.get('/me/favorites', authenticate, asyncMiddleware(listFavoriteGames))
personalRouter.get('/me/recent', authenticate, asyncMiddleware(listRecentGames))
personalRouter.get('/me/recommendations', authenticate, asyncMiddleware(listRecommendedGames))
personalRouter.get('/me/level', authenticate, asyncMiddleware(getUserLevel))
personalRouter.post('/me/level/daily-login', authenticate, asyncMiddleware(claimDailyLoginHandler))
personalRouter.get('/me/owned', authenticate, asyncMiddleware(listOwnedGames))
personalRouter.get('/me/overview', authenticate, asyncMiddleware(getCreatorOverview))
personalRouter.get('/me/analytics', authenticate, asyncMiddleware(getCreatorAnalytics))
personalRouter.get('/me/notifications', authenticate, asyncMiddleware(listGameNotifications))
personalRouter.put('/me/notifications/:notificationId/read', authenticate, asyncMiddleware(markGameNotificationRead))
personalRouter.post('/me/notifications/read-all', authenticate, asyncMiddleware(markAllGameNotificationsRead))
personalRouter.delete('/me/notifications/:notificationId', authenticate, asyncMiddleware(deleteGameNotification))
personalRouter.get('/author/:accountId', optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_AUTHOR), asyncMiddleware(getAuthor))
personalRouter.get('/me/following', authenticate, asyncMiddleware(listFollowing))

export { personalRouter }


async function listGameNotifications (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  const where = { recipientAccountId: user.Account.id }
  const [ total, unread, data ] = await Promise.all([
    GameNotificationModel.count({ where }),
    GameNotificationModel.count({ where: { ...where, readAt: null } }),
    GameNotificationModel.findAll({
      where,
      include: [
        { model: AccountModel, as: 'Actor', required: false },
        { model: GameModel, required: false }
      ],
      order: [ [ 'createdAt', 'DESC' ] ],
      limit: 100
    })
  ])

  return res.json({ total, unread, data: data.map(formatGameNotification) })
}


async function markGameNotificationRead (req: express.Request, res: express.Response) {
  const user = getUser(res)
  const notification = await GameNotificationModel.findOne({
    where: { id: Number(req.params.notificationId), recipientAccountId: user.Account.id }
  })
  if (!notification) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  notification.readAt = notification.readAt || new Date()
  await notification.save()
  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}


async function markAllGameNotificationsRead (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  await GameNotificationModel.update(
    { readAt: new Date() },
    { where: { recipientAccountId: user.Account.id, readAt: null } }
  )
  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}


/**
 * 删除单条游戏通知
 */
async function deleteGameNotification (req: express.Request, res: express.Response) {
  const user = getUser(res)
  const notification = await GameNotificationModel.findOne({
    where: { id: Number(req.params.notificationId), recipientAccountId: user.Account.id }
  })
  if (!notification) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  await notification.destroy()
  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}


async function getAuthor (req: express.Request, res: express.Response) {
  const accountId = Number(req.params.accountId)
  if (!Number.isInteger(accountId) || accountId < 1) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  const account = await AccountModel.load(accountId)
  if (!account?.Actor) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  const sort = req.query.sort === 'plays' || req.query.sort === 'favorites' ? req.query.sort : 'latest'
  const statsCol = (field: string) => `"StatsSummary"."${field}"`
  const order = sort === 'plays'
    ? [ [ 'playCount', 'DESC' ], [ 'publishedAt', 'DESC' ] ]
    : sort === 'favorites'
      ? [ [ literal(statsCol('favorites')), 'DESC' ], [ 'publishedAt', 'DESC' ] ]
      : [ [ 'publishedAt', 'DESC' ], [ 'createdAt', 'DESC' ] ]
  const games = await GameModel.findAll<MGame>({
    subQuery: false,
    where: { ownerAccountId: accountId, status: 'published' },
    attributes: { include: GameModel.getPublicStatsAttributes() },
    include: [
      { model: AccountModel, required: true },
      { model: GameStatsSummaryModel, required: false }
    ],
    order: order as any,
    limit: 100
  })
  const user = getUser(res)
  const following = user?.Account?.Actor
    ? !!await ActorFollowModel.loadByActorAndTarget(user.Account.Actor.id, account.Actor.id)
    : false
  return res.json({
    account: {
      id: account.id,
      name: account.name,
      displayName: account.getDisplayName(),
      description: account.description || '',
      handle: account.Actor.getIdentifier(),
      followers: account.Actor.followersCount || 0
    },
    stats: {
      games: games.length,
      plays: games.reduce((sum, game) => sum + game.playCount, 0),
      likes: games.reduce((sum, game) => sum + Number(game.get?.('gameLikes') || 0), 0),
      favorites: games.reduce((sum, game) => sum + Number(game.get?.('favoriteCount') || 0), 0),
      coins: games.reduce((sum, game) => sum + Number(game.get?.('coinCount') || 0), 0)
    },
    following,
    data: games.map(formatGame)
  })
}


async function getCreatorOverview (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  const games = await GameModel.findAll<MGame>({
    subQuery: false,
    where: { ownerAccountId: user.Account.id, status: { [Op.ne]: 'unlisted' } },
    attributes: { include: GameModel.getPublicStatsAttributes() },
    include: [
      { model: AccountModel, required: true },
      { model: GameStatsSummaryModel, required: false }
    ],
    order: [ [ 'createdAt', 'DESC' ] ]
  })
  const day = new Date().toISOString().slice(0, 10)
  await GameCoinLedgerModel.findOrCreate({
    where: { accountId: user.Account.id, day, kind: 'daily_grant' },
    defaults: { accountId: user.Account.id, gameId: null, day, kind: 'daily_grant', amount: 2 }
  })
  const coinBalance = Number(await GameCoinLedgerModel.sum('amount', { where: { accountId: user.Account.id } }) || 0)
  return res.json({
    gameCount: games.length,
    gameLimit: MAX_GAMES_PER_ACCOUNT,
    storageBytes: games.reduce((sum, game) => sum + game.fileSizeBytes, 0),
    storageLimitBytes: CONFIG.GAMES.MAX_STORAGE_PER_ACCOUNT_BYTES,
    plays: games.reduce((sum, game) => sum + game.playCount, 0),
    likes: games.reduce((sum, game) => sum + Number(game.get?.('gameLikes') || 0), 0),
    coins: games.reduce((sum, game) => sum + Number(game.get?.('coinCount') || 0), 0),
    coinBalance: Math.max(0, coinBalance),
    favorites: games.reduce((sum, game) => sum + Number(game.get?.('favoriteCount') || 0), 0),
    followers: Number((user.Account.Actor as any)?.followersCount || 0),
    games: games.map(formatGame)
  })
}


async function listFavoriteGames (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

  const rows = await GameFavoriteModel.findAll<any>({
    where: { accountId: user.Account.id },
    include: [ {
      model: GameModel,
      where: { status: 'published' },
      required: true,
      attributes: { include: GameModel.getPublicStatsAttributes() },
      include: [
        { model: AccountModel, required: true },
        { model: GameStatsSummaryModel, required: false }
      ]
    } ],
    order: [ [ 'createdAt', 'DESC' ] ],
    limit: 100
  })

  return res.json({ total: rows.length, data: rows.map(row => formatGame(row.Game)) })
}


async function listRecentGames (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

  const rows = await GameRecentModel.findAll<any>({
    where: { accountId: user.Account.id },
    include: [ {
      model: GameModel,
      where: { status: 'published' },
      required: true,
      attributes: { include: GameModel.getPublicStatsAttributes() },
      include: [
        { model: AccountModel, required: true },
        { model: GameStatsSummaryModel, required: false }
      ]
    } ],
    order: [ [ 'lastPlayedAt', 'DESC' ] ],
    limit: 5
  })

  return res.json({ total: rows.length, data: rows.map(row => formatGame(row.Game)) })
}


async function listOwnedGames (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

  const data = await GameModel.findAll<MGame>({
    subQuery: false,
    where: { ownerAccountId: user.Account.id },
    attributes: { include: GameModel.getPublicStatsAttributes() },
    include: [
      { model: AccountModel, required: true },
      { model: GameStatsSummaryModel, required: false }
    ],
    order: [ [ 'createdAt', 'DESC' ] ],
    limit: 100
  })

  return res.json({ total: data.length, data: data.map(formatGame) })
}


async function listRecommendedGames (_req: express.Request, res: express.Response) {
  return traceGameOperation('listRecommendedGames', async () => {
    const user = getUser(res)
    if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

    const result = await getRecommendedGames({ accountId: user.Account.id, limit: 20 })
    return res.json({ total: result.total, data: result.data.map(formatGame) })
  })
}


/**
 * 获取用户等级信息
 */
async function getUserLevel (_req: express.Request, res: express.Response) {
  return traceGameOperation('getUserLevel', async () => {
    const user = getUser(res)
    const info = await getUserLevelInfo(user.Account.id)
    return res.json(info)
  })
}


/**
 * 每日登录签到
 */
async function claimDailyLoginHandler (_req: express.Request, res: express.Response) {
  return traceGameOperation('claimDailyLogin', async () => {
    const user = getUser(res)
    const result = await claimDailyLogin(user.Account.id)
    return res.json(result)
  })
}


/**
 * 创作者数据分析 — 播放趋势/互动分布/游戏排行/粉丝增长
 */
async function getCreatorAnalytics (_req: express.Request, res: express.Response) {
  return traceGameOperation('getCreatorAnalytics', async () => {
    const user = getUser(res)
    const accountId = user.Account.id

    const [ playTrend, interactionBreakdown, gameRanking, followerTrend ] = await Promise.all([
      getCreatorPlayTrend(accountId),
      getCreatorInteractionBreakdown(accountId),
      getCreatorGameRanking(accountId),
      getCreatorFollowerTrend(accountId)
    ])

    return res.json({
      playTrend,
      interactionBreakdown,
      gameRanking,
      followerTrend
    })
  })
}


/**
 * 获取当前用户关注的作者列表
 */
async function listFollowing (req: express.Request, res: express.Response) {
  return traceGameOperation('listFollowing', async () => {
    const user = getUser(res)
    if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

    const follows = await ActorFollowModel.findAll({
      where: { actorId: user.Account.Actor.id, state: 'accepted' },
      attributes: [ 'targetActorId' ],
      raw: true
    })
    const targetActorIds = follows.map(follow => follow.targetActorId)
    if (targetActorIds.length === 0) return res.json({ total: 0, data: [] })

    const actors = await ActorModel.findAll({
      where: { id: targetActorIds },
      include: [
        {
          model: AccountModel,
          required: true
        },
        {
          model: GameModel,
          where: { status: 'published' },
          required: false,
          attributes: [ 'id' ]
        }
      ]
    })

    const data = actors.map(actor => ({
      id: actor.Account.id,
      name: actor.Account.name,
      displayName: actor.Account.getDisplayName(),
      description: actor.Account.description || '',
      handle: actor.getIdentifier(),
      followers: actor.followersCount || 0,
      games: (actor as any).Games?.length || 0
    }))

    return res.json({ total: data.length, data })
  })
}
