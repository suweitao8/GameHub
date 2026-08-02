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
  const tags = Array.isArray(game.tags) ? game.tags.filter(t => typeof t === 'string') : []

  // 1. Same category, overlap tags, exclude self, published only
  const candidates = await GameModel.findAll<MGame>({
    subQuery: false,
    where: {
      status: 'published',
      id: { [Op.ne]: game.id },
      category: game.category
    },
    attributes: { include: GameModel.getPublicStatsAttributes() },
    include: [
      { model: AccountModel, required: true },
      { model: GameStatsSummaryModel, required: false }
    ],
    limit: 60
  })

  // 2. Score by tag overlap, then by play count
  const scored = candidates.map(c => {
    const candidateTags = Array.isArray(c.tags) ? c.tags.filter(t => typeof t === 'string') : []
    const overlap = tags.filter(t => candidateTags.includes(t)).length
    return { game: c, overlap, playCount: Number(c.playCount || 0) }
  })
  scored.sort((a, b) => (b.overlap - a.overlap) || (b.playCount - a.playCount))

  // 3. If not enough same-category, fill from same author / popular
  let result = scored.slice(0, limit)
  if (result.length < limit) {
    const existingIds = new Set(result.map(r => r.game.id).concat([ game.id ]))
    const fillers = await GameModel.findAll<MGame>({
      subQuery: false,
      where: {
        status: 'published',
        id: { [Op.notIn]: Array.from(existingIds) },
        [Op.or]: [
          { ownerAccountId: game.ownerAccountId },
          { playCount: { [Op.gte]: 1 } }
        ]
      },
      attributes: { include: GameModel.getPublicStatsAttributes() },
      include: [
        { model: AccountModel, required: true },
        { model: GameStatsSummaryModel, required: false }
      ],
      order: [ [ 'playCount', 'DESC' ], [ 'publishedAt', 'DESC' ] ],
      limit: limit - result.length
    })
    result = result.concat(fillers.map(g => ({ game: g, overlap: 0, playCount: Number(g.playCount || 0) })))
  }

  const data = result.slice(0, limit).map(({ game: g }) => {
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
  })

  return res.json({ total: data.length, data })
}
