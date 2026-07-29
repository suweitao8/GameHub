import { HttpStatusCode } from '@peertube/peertube-models'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { getCreatorPlayTrend, getCreatorInteractionBreakdown, getCreatorGameRanking, getCreatorFollowerTrend } from '@server/lib/games/game-analytics.js'
import { CONFIG } from '@server/initializers/config.js'
import { GameModel } from '@server/models/game/game.js'
import { GameStatsSummaryModel } from '@server/models/game/game-stats-summary.js'
import { GameCoinLedgerModel } from '@server/models/game/game-coin-ledger.js'
import { AccountModel } from '@server/models/account/account.js'
import type { MGame } from '@server/types/models/game/game.js'
import { asyncMiddleware, authenticate } from '@server/middlewares/index.js'
import express from 'express'
import { Op } from 'sequelize'
import { MAX_GAMES_PER_ACCOUNT, getUser, formatGame } from './game-shared.js'

const personalCreatorRouter = express.Router()

personalCreatorRouter.get('/me/owned', authenticate, asyncMiddleware(listOwnedGames))
personalCreatorRouter.get('/me/overview', authenticate, asyncMiddleware(getCreatorOverview))
personalCreatorRouter.get('/me/analytics', authenticate, asyncMiddleware(getCreatorAnalytics))

export { personalCreatorRouter }

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
