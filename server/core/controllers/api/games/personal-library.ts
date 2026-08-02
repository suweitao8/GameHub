import { HttpStatusCode } from '@peertube/peertube-models'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { getRecommendedGames } from '@server/lib/games/game-recommendations.js'
import { GameModel } from '@server/models/game/game.js'
import { GameStatsSummaryModel } from '@server/models/game/game-stats-summary.js'
import { GameFavoriteModel } from '@server/models/game/game-favorite.js'
import { GameRecentModel } from '@server/models/game/game-recent.js'
import { AccountModel } from '@server/models/account/account.js'
import { asyncMiddleware, authenticate } from '@server/middlewares/index.js'
import express from 'express'
import { getUser, formatGame } from './game-shared.js'

const personalLibraryRouter = express.Router()

personalLibraryRouter.get('/me/favorites', authenticate, asyncMiddleware(listFavoriteGames))
personalLibraryRouter.get('/me/recent', authenticate, asyncMiddleware(listRecentGames))
personalLibraryRouter.get('/me/recommendations', authenticate, asyncMiddleware(listRecommendedGames))

export { personalLibraryRouter }

async function listFavoriteGames (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

  const rows = await GameFavoriteModel.findAll<any>({
    subQuery: false,
    where: { accountId: user.Account.id },
    include: [ {
      model: GameModel,
      where: { status: 'published' },
      required: true,
      attributes: { include: GameModel.getPublicStatsAttributes('Game->StatsSummary') },
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
    subQuery: false,
    where: { accountId: user.Account.id },
    include: [ {
      model: GameModel,
      where: { status: 'published' },
      required: true,
      attributes: { include: GameModel.getPublicStatsAttributes('Game->StatsSummary') },
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

async function listRecommendedGames (_req: express.Request, res: express.Response) {
  return traceGameOperation('listRecommendedGames', async () => {
    const user = getUser(res)
    if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

    const result = await getRecommendedGames({ accountId: user.Account.id, limit: 20 })
    return res.json({ total: result.total, data: result.data.map(formatGame) })
  })
}
