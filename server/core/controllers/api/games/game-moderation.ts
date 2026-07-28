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

const moderationRouter = express.Router()

moderationRouter.post('/:uuid/report', gameUUIDValidator, authenticate, asyncMiddleware(reportGame))
moderationRouter.post('/:uuid/moderate', authenticate, gameModerationValidator, asyncMiddleware(moderateGame))
moderationRouter.put('/:uuid/featured', authenticate, gameUUIDValidator, asyncMiddleware(setFeatured))

export { moderationRouter }


async function moderateGame (req: express.Request, res: express.Response) {
  return traceGameOperation('moderateGame', async () => {
    const user = getUser(res)
    if (!user || !isGameModerator(user)) return res.sendStatus(HttpStatusCode.FORBIDDEN_403)

    const game = await GameModel.loadByUUID(req.params.uuid)
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const status = getModerationStatus(req.body.action, game.status)
    if (!status) return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Invalid game moderation transition' })

    const oldGame = formatGame(game)
    game.status = status
    game.moderationReason = req.body.reason || null
    game.moderatedByAccountId = user.Account.id
    game.moderatedAt = new Date()
    game.publishedAt = status === 'published' ? new Date() : null
    await game.save()
    if (game.ownerAccountId !== user.Account.id) {
      await createGameNotification({
        recipientAccountId: game.ownerAccountId,
        actorAccountId: user.Account.id,
        gameId: game.id,
        kind: 'moderation',
        message: `你的游戏审核状态已更新为：${status}`
      })
    }

    auditLogger.update(getAuditIdFromRes(res), new GameAuditView(formatGame(game)), new GameAuditView(oldGame))

    return res.json(formatGame(game))
  })
}


/**
 * 管理员设置/取消精选 — 仅管理员和版主可操作
 */
async function setFeatured (req: express.Request, res: express.Response) {
  return traceGameOperation('setFeatured', async () => {
    const user = getUser(res)
    if (!user || !isGameModerator(user)) return res.sendStatus(HttpStatusCode.FORBIDDEN_403)

    const game = await GameModel.loadByUUID(req.params.uuid)
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    if (typeof req.body.featured !== 'boolean') {
      return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'featured must be boolean' })
    }

    game.featured = req.body.featured
    game.featuredAt = req.body.featured ? new Date() : null
    await game.save()

    return res.json({ featured: game.featured, featuredAt: game.featuredAt })
  })
}


/**
 * 举报游戏
 */
async function reportGame (req: express.Request, res: express.Response) {
  return traceGameOperation('reportGame', async () => {
    const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const user = getUser(res)
    const reason = String(req.body.reason || '').trim()
    if (!reason) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'reason is required' })

    const predefinedReasons = Array.isArray(req.body.predefinedReasons)
      ? req.body.predefinedReasons.filter((r: unknown) => typeof r === 'string').slice(0, 10)
      : []

    const report = await GameReportModel.create({
      reporterAccountId: user.Account.id,
      gameId: game.id,
      commentId: null,
      reason,
      state: 'pending',
      predefinedReasons
    })

    return res.status(HttpStatusCode.CREATED_201).json({
      id: report.id,
      state: report.state,
      createdAt: report.createdAt
    })
  })
}
