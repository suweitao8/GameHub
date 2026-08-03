import { HttpStatusCode } from '@peertube/peertube-models'
import { generateGameCoverSignedUrl } from '@server/lib/games/game-cdn.js'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { GameFavoriteModel } from '@server/models/game/game-favorite.js'
import { GameChatMessageModel } from '@server/models/game/game-chat-message.js'
import { GameStatsSummaryModel } from '@server/models/game/game-stats-summary.js'
import { GameModel } from '@server/models/game/game.js'
import type { MGame } from '@server/types/models/game/game.js'
import { asyncMiddleware, optionalAuthenticate } from '@server/middlewares/index.js'
import { gameUUIDValidator } from '@server/middlewares/validators/games.js'
import express from 'express'
import { Op } from 'sequelize'
import { getGameAuthor, getPublishedGame, getUser } from './community-shared.js'
import { getCoinState, userRating } from './community-interactions.js'

const communityOverviewRouter = express.Router()

communityOverviewRouter.get('/:uuid/community', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(getCommunity))
communityOverviewRouter.get('/:uuid/related', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(listRelatedGames))

export { communityOverviewRouter }

async function getCommunity (req: express.Request, res: express.Response) {
  return traceGameOperation('getCommunity', async () => {
    const game = await getPublishedGame(req)
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const author = await getGameAuthor(game)
    const user = getUser(res)
    const [ following, favorite, rating, coinState, stats, chatMessages ] = await Promise.all([
      author?.Actor && user
        ? ActorFollowModel.loadByActorAndTarget(user.Account.Actor.id, author.Actor.id).then(r => !!r)
        : Promise.resolve(false),
      user
        ? GameFavoriteModel.findOne({ where: { gameId: game.id, accountId: user.Account.id } }).then(r => !!r)
        : Promise.resolve(false),
      user ? userRating(user.Account.id, game.id) : Promise.resolve(null),
      user ? getCoinState(game.id, user.Account.id) : Promise.resolve({ balance: 0, given: 0 }),
      GameStatsSummaryModel.findOne({ where: { gameId: game.id }, raw: true }),
      GameChatMessageModel.count({ where: { gameId: game.id } })
    ])

    return res.json({
      isOwner: !!user && user.Account.id === game.ownerAccountId,
      likes: stats?.likes || 0,
      chatMessages: chatMessages || 0,
      rating,
      favorite,
      following,
      coins: Math.max(0, stats?.coins || 0),
      favorites: Number(stats?.favorites) || 0,
      shares: Number(stats?.shares) || 0,
      coinBalance: coinState.balance,
      coinsGiven: coinState.given,
      author: author
        ? {
            id: author.id,
            name: author.name,
            displayName: author.getDisplayName(),
            handle: author.Actor?.getIdentifier()
          }
        : null
    })
  })
}

/**
 * 返回相似游戏：优先同分类且标签重合多的游戏
 * 用于详情页右侧栏「相关推荐」
 */
async function listRelatedGames (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const limit = Math.min(20, Math.max(1, Number(req.query.count) || 8))
  const developerLimit = Math.min(3, limit)
  const relatedLimit = Math.max(0, limit - developerLimit)
  const tags = Array.isArray(game.tags) ? game.tags.filter(t => typeof t === 'string') : []
  const buildGameInclude = () => [
    { model: AccountModel, required: true },
    { model: GameStatsSummaryModel, required: false }
  ]

  const developerGames = await GameModel.findAll<MGame>({
    subQuery: false,
    where: {
      status: 'published',
      id: { [Op.ne]: game.id },
      ownerAccountId: game.ownerAccountId
    },
    attributes: { include: GameModel.getPublicStatsAttributes() },
    include: buildGameInclude(),
    order: [ [ 'playCount', 'DESC' ], [ 'publishedAt', 'DESC' ] ],
    limit: developerLimit
  })

  const excludedIds = new Set(developerGames.map(g => g.id).concat([ game.id ]))

  let relatedGames: MGame[] = []
  if (relatedLimit > 0) {
    const candidates = await GameModel.findAll<MGame>({
      subQuery: false,
      where: {
        status: 'published',
        id: { [Op.notIn]: Array.from(excludedIds) },
        category: game.category
      },
      attributes: { include: GameModel.getPublicStatsAttributes() },
      include: buildGameInclude(),
      limit: Math.max(60, relatedLimit * 4)
    })

    const scored = candidates.map(candidate => {
      const candidateTags = Array.isArray(candidate.tags) ? candidate.tags.filter(t => typeof t === 'string') : []
      const overlap = tags.filter(t => candidateTags.includes(t)).length
      return { game: candidate, overlap, playCount: Number(candidate.playCount || 0) }
    })
    scored.sort((a, b) => (b.overlap - a.overlap) || (b.playCount - a.playCount))
    relatedGames = scored.slice(0, relatedLimit).map(item => item.game)
  }

  const formatGame = (g: MGame) => {
    const owner = (g as any).Owner
    return {
      uuid: g.uuid,
      title: g.title,
      category: g.category,
      tags: Array.isArray(g.tags) ? g.tags.filter((t: unknown) => typeof t === 'string') : [],
      coverPath: g.coverPath ? generateGameCoverSignedUrl({ uuid: g.uuid }) : null,
      coverFallback: null,
      playCount: Number(g.playCount || 0),
      comments: Number(g.get?.('gameComments') ?? 0),
      favorites: Number(g.get?.('favoriteCount') ?? 0),
      publishedAt: g.publishedAt,
      author: owner?.Actor
        ? { id: owner.id, name: owner.name, displayName: owner.getDisplayName(), handle: owner.Actor.getIdentifier() }
        : null
    }
  }

  const developerData = developerGames.map(formatGame)
  const relatedData = relatedGames.map(formatGame)
  const data = developerData.concat(relatedData)

  return res.json({
    total: data.length,
    developerGames: developerData,
    relatedGames: relatedData,
    data
  })
}
