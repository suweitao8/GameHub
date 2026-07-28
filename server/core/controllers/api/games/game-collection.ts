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

const collectionRouter = express.Router()

collectionRouter.get('/collections', optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_LIST), asyncMiddleware(listCollections))
collectionRouter.get('/collections/:slug', optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_DETAIL), asyncMiddleware(getCollection))

export { collectionRouter }


/**
 * 专题合集列表
 */
async function listCollections (req: express.Request, res: express.Response) {
  return traceGameOperation('listCollections', async () => {
    const collections = await GameCollectionModel.findAll({
      where: { status: 'published' },
      order: [ [ 'sortOrder', 'ASC' ], [ 'createdAt', 'DESC' ] ],
      limit: 50
    })

    return res.json({
      total: collections.length,
      data: collections.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        slug: c.slug,
        coverPath: c.coverPath,
        gameCount: 0
      }))
    })
  })
}


/**
 * 专题合集详情
 */
async function getCollection (req: express.Request, res: express.Response) {
  return traceGameOperation('getCollection', async () => {
    const slug = req.params.slug
    const collection = await GameCollectionModel.findOne({
      where: { slug, status: 'published' }
    })

    if (!collection) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const items = await GameCollectionItemModel.findAll({
      where: { collectionId: collection.id },
      include: [
        { model: GameModel, required: true, include: [
          { model: AccountModel, required: true },
          { model: GameStatsSummaryModel, required: false }
        ] }
      ],
      order: [ [ 'sortOrder', 'ASC' ] ]
    })

    return res.json({
      id: collection.id,
      title: collection.title,
      description: collection.description,
      slug: collection.slug,
      coverPath: collection.coverPath,
      total: items.length,
      data: items.map(item => formatGame(item.Game))
    })
  })
}
