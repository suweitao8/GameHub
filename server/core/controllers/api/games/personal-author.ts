import { HttpStatusCode } from '@peertube/peertube-models'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { ROUTE_CACHE_LIFETIME } from '@server/initializers/constants.js'
import { GameModel } from '@server/models/game/game.js'
import { GameStatsSummaryModel } from '@server/models/game/game-stats-summary.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { AccountModel } from '@server/models/account/account.js'
import type { MGame } from '@server/types/models/game/game.js'
import { asyncMiddleware, authenticate, optionalAuthenticate } from '@server/middlewares/index.js'
import { cacheRoute } from '@server/middlewares/cache/cache.js'
import express from 'express'
import { literal } from 'sequelize'
import { getUser, formatGame } from './game-shared.js'

const personalAuthorRouter = express.Router()

personalAuthorRouter.get('/author/:accountId', optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_AUTHOR), asyncMiddleware(getAuthor))
personalAuthorRouter.get('/me/following', authenticate, asyncMiddleware(listFollowing))

export { personalAuthorRouter }

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
