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

const reservationRouter = express.Router()

reservationRouter.post('/:uuid/reserve', gameUUIDValidator, authenticate, asyncMiddleware(reserveGame))
reservationRouter.delete('/:uuid/reserve', gameUUIDValidator, authenticate, asyncMiddleware(cancelReserve))
reservationRouter.get('/me/reservations', authenticate, asyncMiddleware(listReservations))

export { reservationRouter }


/**
 * 预约游戏
 */
async function reserveGame (req: express.Request, res: express.Response) {
  return traceGameOperation('reserveGame', async () => {
    const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const user = getUser(res)
    if (game.ownerAccountId === user.Account.id) {
      return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: '不能预约自己的游戏' })
    }

    const [ reserve, created ] = await GameReserveModel.findOrCreate({
      where: { gameId: game.id, accountId: user.Account.id },
      defaults: { gameId: game.id, accountId: user.Account.id, notified: false }
    })

    if (!created) return res.status(HttpStatusCode.CONFLICT_409).json({ error: '已预约' })

    return res.status(HttpStatusCode.CREATED_201).json({
      id: reserve.id,
      gameId: reserve.gameId,
      createdAt: reserve.createdAt
    })
  })
}


/**
 * 取消预约
 */
async function cancelReserve (req: express.Request, res: express.Response) {
  return traceGameOperation('cancelReserve', async () => {
    const game = await GameModel.loadByUUID(req.params.uuid)
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const user = getUser(res)
    const reserve = await GameReserveModel.findOne({
      where: { gameId: game.id, accountId: user.Account.id }
    })
    if (!reserve) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    await reserve.destroy()
    return res.status(HttpStatusCode.NO_CONTENT_204).end()
  })
}


/**
 * 查询用户预约列表
 */
async function listReservations (_req: express.Request, res: express.Response) {
  return traceGameOperation('listReservations', async () => {
    const user = getUser(res)
    const rows = await GameReserveModel.findAll({
      where: { accountId: user.Account.id },
      include: [
        {
          model: GameModel,
          where: { status: { [Op.ne]: 'blocked' } },
          required: true,
          include: [
            { model: AccountModel, required: true },
            { model: GameStatsSummaryModel, required: false }
          ]
        }
      ],
      order: [ [ 'createdAt', 'DESC' ] ]
    })

    return res.json({
      total: rows.length,
      data: rows.map(row => ({
        id: row.id,
        notified: row.notified,
        createdAt: row.createdAt,
        game: formatGame(row.Game)
      }))
    })
  })
}
