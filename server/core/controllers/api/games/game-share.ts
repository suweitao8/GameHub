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

const shareRouter = express.Router()

shareRouter.get('/s/:token', asyncMiddleware(resolveShare))
shareRouter.post('/:uuid/share', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(shareGame))

export { shareRouter }


async function shareGame (req: express.Request, res: express.Response) {
  const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const shareInfo = await createGameShareToken(game.uuid)
  return res.json(shareInfo)
}


async function resolveShare (req: express.Request, res: express.Response) {
  const uuid = await resolveGameShareToken(req.params.token)
  if (!uuid) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const game = await GameModel.loadByUUID(uuid, { publishedOnly: true })
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  return res.redirect(`/games/${uuid}`)
}
