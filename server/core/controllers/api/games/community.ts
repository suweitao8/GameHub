import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { CONFIG } from '@server/initializers/config.js'
import { generateGameCoverSignedUrl } from '@server/lib/games/game-cdn.js'
import { JobQueue } from '@server/lib/job-queue/index.js'
import { sendUndoFollow } from '@server/lib/activitypub/send/index.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { GameFavoriteModel } from '@server/models/game/game-favorite.js'
import { GameCoinLedgerModel } from '@server/models/game/game-coin-ledger.js'
import { GameCommentReactionModel } from '@server/models/game/game-comment-reaction.js'
import { GameCommentModel } from '@server/models/game/game-comment.js'
import { GameReviewModel } from '@server/models/game/game-review.js'
import { GameRatingModel, type GameRatingType } from '@server/models/game/game-rating.js'
import { GameModel } from '@server/models/game/game.js'
import { GameStatsSummaryModel } from '@server/models/game/game-stats-summary.js'
import type { MGame } from '@server/types/models/game/game.js'
import { apiRateLimiter, asyncMiddleware, authenticate, gameCoinRateLimiter, gameCommentRateLimiter, gameFavoriteRateLimiter, gameRatingRateLimiter, gameReviewRateLimiter, optionalAuthenticate } from '@server/middlewares/index.js'
import { gameUUIDValidator } from '@server/middlewares/validators/games.js'
import express from 'express'
import { Op } from 'sequelize'
import { canDeleteGameComment, isSupportedGameRating, normalizeGameRating } from '../../../lib/games/game-community-policy.js'
import { createGameNotification } from '../../../lib/games/game-notifications.js'
import { traceGameOperation } from '../../../lib/games/game-tracing.js'
import { invalidateRecommendationCache } from '../../../lib/games/game-recommendations.js'
import { awardExp } from '../../../lib/games/game-exp.js'
import { GameActivityModel } from '@server/models/game/game-activity.js'

type CommentSortOption = 'hot' | 'new' | 'old'

const gameCommunityRouter = express.Router()
gameCommunityRouter.use(apiRateLimiter)

gameCommunityRouter.get('/:uuid/community', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(getCommunity))
gameCommunityRouter.get('/:uuid/rating-distribution', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(getRatingDistribution))
gameCommunityRouter.get('/:uuid/related', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(listRelatedGames))
gameCommunityRouter.get('/:uuid/reviews', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(listReviews))
gameCommunityRouter.put('/:uuid/review', gameUUIDValidator, authenticate, gameReviewRateLimiter, asyncMiddleware(upsertReview))
gameCommunityRouter.get('/:uuid/comments/featured', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(listFeaturedComments))
gameCommunityRouter.get('/:uuid/comments', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(listComments))
gameCommunityRouter.get('/:uuid/comments/:commentId/replies', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(listReplies))
gameCommunityRouter.post('/:uuid/comments', gameUUIDValidator, authenticate, gameCommentRateLimiter, asyncMiddleware(addComment))
gameCommunityRouter.post('/:uuid/comments/:commentId/reply', gameUUIDValidator, authenticate, gameCommentRateLimiter, asyncMiddleware(replyToComment))
gameCommunityRouter.put('/:uuid/comments/:commentId/like', gameUUIDValidator, authenticate, gameRatingRateLimiter, asyncMiddleware(likeComment))
gameCommunityRouter.delete('/:uuid/comments/:commentId', gameUUIDValidator, authenticate, asyncMiddleware(deleteComment))
gameCommunityRouter.put('/:uuid/rate', gameUUIDValidator, authenticate, gameRatingRateLimiter, asyncMiddleware(rateGame))
gameCommunityRouter.put('/:uuid/favorite', gameUUIDValidator, authenticate, gameFavoriteRateLimiter, asyncMiddleware(favoriteGame))
gameCommunityRouter.put('/:uuid/follow', gameUUIDValidator, authenticate, asyncMiddleware(followAuthor))
gameCommunityRouter.put('/author/:accountId/follow', authenticate, asyncMiddleware(followAccount))
gameCommunityRouter.post('/:uuid/coin', gameUUIDValidator, authenticate, gameCoinRateLimiter, asyncMiddleware(coinGame))
gameCommunityRouter.post('/:uuid/triple', gameUUIDValidator, authenticate, gameRatingRateLimiter, asyncMiddleware(tripleAction))

export { gameCommunityRouter }

async function getPublishedGame (req: express.Request) {
  return GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
}

function getUser (res: express.Response) {
  return res.locals.oauth?.token.User
}

async function getGameAuthor (game: MGame) {
  return AccountModel.findByPk(game.ownerAccountId, {
    include: [ { model: ActorModel, required: true } ]
  })
}

const commentAccountInclude = {
  model: AccountModel,
  required: false,
  include: [ { model: ActorModel, required: false } ]
}

async function getCommentForGame (game: MGame | null, commentId: number, includeDeleted = false) {
  if (!game || !Number.isInteger(commentId)) return null

  const where: any = { gameId: game.id, id: commentId }
  if (!includeDeleted) where.deletedAt = null

  return GameCommentModel.findOne({
    where,
    include: [ commentAccountInclude ]
  })
}

async function getCommunity (req: express.Request, res: express.Response) {
  return traceGameOperation('getCommunity', async () => {
    const game = await getPublishedGame(req)
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const author = await getGameAuthor(game)
    const user = getUser(res)
    const [ following, favorite, rating, coinState, stats ] = await Promise.all([
      author?.Actor && user
        ? ActorFollowModel.loadByActorAndTarget(user.Account.Actor.id, author.Actor.id).then(r => !!r)
        : Promise.resolve(false),
      user
        ? GameFavoriteModel.findOne({ where: { gameId: game.id, accountId: user.Account.id } }).then(r => !!r)
        : Promise.resolve(false),
      user ? userRating(user.Account.id, game.id) : Promise.resolve(null),
      user ? getCoinState(game.id, user.Account.id) : Promise.resolve({ balance: 0, given: 0 }),
      GameStatsSummaryModel.findOne({ where: { gameId: game.id }, raw: true })
    ])

    return res.json({
      isOwner: !!user && user.Account.id === game.ownerAccountId,
      likes: stats?.likes || 0,
      reviews: stats?.reviews || 0,
      averageReviewScore: Number(Number(stats?.averageReviewScore || 0).toFixed(1)),
      chatMessages: stats?.comments || 0,
      rating,
      favorite,
      following,
      coins: Math.max(0, stats?.coins || 0),
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

async function listReviews (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const start = Math.max(0, Number(req.query.start) || 0)
  const count = Math.min(50, Math.max(1, Number(req.query.count) || 20))

  const [ total, reviews ] = await Promise.all([
    GameReviewModel.count({ where: { gameId: game.id } }),
    GameReviewModel.findAll({
      where: { gameId: game.id },
      include: [ commentAccountInclude ],
      order: [ [ 'createdAt', 'DESC' ] ],
      limit: count,
      offset: start
    })
  ])

  return res.json({ total, data: formatReviews(reviews, game) })
}

/**
 * 返回游戏评分分布：5 星到 1 星每个分数的评论数量与百分比
 * 用于详情页评分柱状图
 */
async function getRatingDistribution (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const rows = await GameReviewModel.findAll({
    where: { gameId: game.id },
    attributes: [ 'score', [ GameReviewModel.sequelize.fn('COUNT', GameReviewModel.sequelize.col('id')), 'count' ] ],
    group: [ 'score' ],
    raw: true
  }) as unknown as Array<{ score: number, count: number }>

  const distribution = [ 5, 4, 3, 2, 1 ].map(star => {
    const row = rows.find(r => Number(r.score) === star)
    const count = Number(row?.count || 0)
    return { star, count }
  })
  const total = distribution.reduce((sum, item) => sum + item.count, 0)
  const withPercent = distribution.map(item => ({
    star: item.star,
    count: item.count,
    percent: total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0
  }))

  return res.json({ total, distribution: withPercent })
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

  const baseUrl = `${CONFIG.WEBSERVER.SCHEME}://${CONFIG.WEBSERVER.HOSTNAME}:${CONFIG.WEBSERVER.PORT}`
  const data = result.slice(0, limit).map(({ game: g }) => {
    const owner = (g as any).Owner
    return {
      uuid: g.uuid,
      title: g.title,
      category: g.category,
      tags: Array.isArray(g.tags) ? g.tags.filter((t: unknown) => typeof t === 'string') : [],
      coverPath: g.coverPath ? generateGameCoverSignedUrl({ uuid: g.uuid }) : null,
      coverFallback: g.coverPath ? null : `${baseUrl}/api/v1/games/${g.uuid}/cover`,
      playCount: Number(g.playCount || 0),
      likes: Number(g.get?.('gameLikes') ?? 0),
      favorites: Number(g.get?.('favoriteCount') ?? 0),
      publishedAt: g.publishedAt,
      author: owner?.Actor
        ? { id: owner.id, name: owner.name, displayName: owner.getDisplayName(), handle: owner.Actor.getIdentifier() }
        : null
    }
  })

  return res.json({ total: data.length, data })
}

async function upsertReview (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  const score = Number(req.body.score)
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : ''
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (game.ownerAccountId === user.Account.id) return res.status(HttpStatusCode.FORBIDDEN_403).json({ error: 'Authors cannot review their own game' })
  if (!Number.isInteger(score) || score < 1 || score > 5 || !text || text.length > 5000) {
    return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'score must be 1-5 and text must contain 1-5000 characters' })
  }

  const [ review, created ] = await GameReviewModel.findOrCreate({
    where: { gameId: game.id, accountId: user.Account.id },
    defaults: { gameId: game.id, accountId: user.Account.id, score, text }
  })
  if (!created) {
    review.score = score
    review.text = text
    await review.save()
  }

  if (created) {
    await createGameNotification({
      recipientAccountId: game.ownerAccountId,
      actorAccountId: user.Account.id,
      gameId: game.id,
      kind: 'comment',
      message: `${user.username} 评价了你的游戏`
    })
  }

  const hydratedReview = await GameReviewModel.findOne({
    where: { id: review.id },
    include: [ commentAccountInclude ]
  })
  if (!hydratedReview) return res.sendStatus(HttpStatusCode.INTERNAL_SERVER_ERROR_500)
  if (created) {
    awardExp(user.Account.id, 'REVIEW').catch(() => undefined)

    GameActivityModel.createActivity({
      actorAccountId: user.Account.id,
      gameId: game.id,
      kind: 'review',
      message: `${user.username} 评价了游戏《${game.title}》`
    }).catch(() => undefined)
  }
  return res.json({ review: formatReviews([ hydratedReview ], game)[0] })
}

async function listComments (req: express.Request, res: express.Response) {
  return traceGameOperation('listComments', async () => {
    const game = await getPublishedGame(req)
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const start = Math.max(0, Number(req.query.start) || 0)
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 20))
    const sort = parseCommentSort(req.query.sort as string)

    const where = { gameId: game.id, inReplyToCommentId: null, deletedAt: null }
    const order = getCommentSortOrder(sort)

    const [ total, comments ] = await Promise.all([
      GameCommentModel.count({ where }),
      GameCommentModel.findAll({
        where,
        include: [ commentAccountInclude ],
        order,
        limit: count,
        offset: start
      })
    ])

    return res.json({ total, data: await formatComments(comments, game, getUser(res)) })
  })
}

async function listReplies (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const commentId = Number(req.params.commentId)
  if (!game || !Number.isInteger(commentId)) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const parent = await getCommentForGame(game, commentId)
  if (!parent) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const start = Math.max(0, Number(req.query.start) || 0)
  const count = Math.min(50, Math.max(1, Number(req.query.count) || 20))

  const where = { gameId: game.id, inReplyToCommentId: commentId, deletedAt: null }
  const [ total, comments ] = await Promise.all([
    GameCommentModel.count({ where }),
    GameCommentModel.findAll({
      where,
      include: [ commentAccountInclude ],
      order: [ [ 'createdAt', 'ASC' ] ],
      limit: count,
      offset: start
    })
  ])

  return res.json({ total, data: await formatComments(comments, game, getUser(res)) })
}

async function addComment (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (typeof req.body.text !== 'string' || req.body.text.trim().length === 0 || req.body.text.length > 5000) {
    return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'text must contain 1-5000 characters' })
  }

  const comment = await GameCommentModel.create({
    gameId: game.id,
    accountId: user.Account.id,
    inReplyToCommentId: null,
    text: req.body.text.trim(),
    deletedAt: null
  })

  const hydratedComment = await getCommentForGame(game, comment.id)
  if (game.ownerAccountId !== user.Account.id) {
    await createGameNotification({
      recipientAccountId: game.ownerAccountId,
      actorAccountId: user.Account.id,
      gameId: game.id,
      kind: 'comment',
      message: `${user.username} 评论了你的游戏`
    })
  }
  awardExp(user.Account.id, 'COMMENT').catch(() => undefined)

  GameActivityModel.createActivity({
    actorAccountId: user.Account.id,
    gameId: game.id,
    kind: 'comment',
    message: `${user.username} 评论了游戏《${game.title}》`
  }).catch(() => undefined)

  return res.status(HttpStatusCode.CREATED_201).json({ comment: (await formatComments([ hydratedComment ], game, user))[0] })
}

async function replyToComment (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : ''
  const commentId = Number(req.params.commentId)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (!text || text.length > 5000 || !Number.isInteger(commentId)) {
    return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'text and commentId are required' })
  }
  const parent = await getCommentForGame(game, commentId)
  if (!parent) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const comment = await GameCommentModel.create({
    gameId: game.id,
    accountId: user.Account.id,
    inReplyToCommentId: parent.id,
    text,
    deletedAt: null
  })
  const hydratedComment = await getCommentForGame(game, comment.id)
  if (game.ownerAccountId !== user.Account.id) {
    await createGameNotification({
      recipientAccountId: game.ownerAccountId,
      actorAccountId: user.Account.id,
      gameId: game.id,
      kind: 'reply',
      message: `${user.username} 回复了你的游戏评论`
    })
  }
  awardExp(user.Account.id, 'COMMENT').catch(() => undefined)

  GameActivityModel.createActivity({
    actorAccountId: user.Account.id,
    gameId: game.id,
    kind: 'reply',
    message: `${user.username} 回复了游戏《${game.title}》的评论`
  }).catch(() => undefined)

  return res.status(HttpStatusCode.CREATED_201).json({ comment: (await formatComments([ hydratedComment ], game, user))[0] })
}

async function likeComment (req: express.Request, res: express.Response) {
  return traceGameOperation('likeComment', async () => {
    const game = await getPublishedGame(req)
    const user = getUser(res)
    const comment = await getCommentForGame(game, Number(req.params.commentId))
    if (!game || !comment) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
    if (typeof req.body.liked !== 'boolean') return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'liked must be boolean' })

    const existing = await GameCommentReactionModel.findOne({ where: { commentId: comment.id, accountId: user.Account.id } })
    if (req.body.liked && !existing) {
      await GameCommentReactionModel.create({ commentId: comment.id, accountId: user.Account.id })
      comment.likeCount += 1
    }
    if (!req.body.liked && existing) {
      await existing.destroy()
      comment.likeCount = Math.max(0, comment.likeCount - 1)
    }

    // 更新精选状态
    if (comment.updateFeaturedStatus() || comment.likeCount !== comment.getDataValue('likeCount')) {
      await comment.save()
    }

    return res.json({ liked: req.body.liked, likes: comment.likeCount, isFeatured: comment.isFeatured })
  })
}

async function deleteComment (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  const comment = await getCommentForGame(game, Number(req.params.commentId))
  if (!game || !comment) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const canManageAny = user.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT)
  if (!canDeleteGameComment({
    commentAccountId: comment.accountId,
    userAccountId: user.Account.id,
    gameOwnerAccountId: game.ownerAccountId,
    canManageAny
  })) return res.sendStatus(HttpStatusCode.FORBIDDEN_403)

  comment.deletedAt = new Date()
  await comment.save()
  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function rateGame (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  const rating = req.body.rating
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (game.ownerAccountId === user.Account.id) return res.status(HttpStatusCode.FORBIDDEN_403).json({ error: 'Authors cannot rate their own game' })
  if (!isSupportedGameRating(rating)) {
    return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'rating must be like or none' })
  }

  await sequelizeTypescript.transaction(async transaction => {
    const previous = await GameRatingModel.load(user.Account.id, game.id, transaction)
    if (rating === 'none') {
      if (previous) await previous.destroy({ transaction })
      return
    }

    if (previous) {
      previous.type = rating as GameRatingType
      await previous.save({ transaction })
      return
    }

    await GameRatingModel.create({
      accountId: user.Account.id,
      gameId: game.id,
      type: rating as GameRatingType
    }, { transaction })
  })
  if (rating === 'like') {
    await createGameNotification({
      recipientAccountId: game.ownerAccountId,
      actorAccountId: user.Account.id,
      gameId: game.id,
      kind: 'like',
      message: `${user.username} 赞了你的游戏`
    })
    awardExp(user.Account.id, 'LIKE').catch(() => undefined)

    GameActivityModel.createActivity({
      actorAccountId: user.Account.id,
      gameId: game.id,
      kind: 'like',
      message: `${user.username} 赞了游戏《${game.title}》`
    }).catch(() => undefined)
  }
  invalidateRecommendationCache(user.Account.id).catch(() => undefined)
  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function coinGame (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  const amount = Number(req.body.amount)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (game.ownerAccountId === user.Account.id) return res.status(HttpStatusCode.FORBIDDEN_403).json({ error: 'Authors cannot coin their own game' })
  if (amount !== 1 && amount !== 2) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'amount must be 1 or 2' })

  const result = await sequelizeTypescript.transaction(async transaction => {
    const day = new Date().toISOString().slice(0, 10)
    await GameCoinLedgerModel.findOrCreate({
      where: { accountId: user.Account.id, day, kind: 'daily_grant' },
      defaults: { accountId: user.Account.id, gameId: null, day, kind: 'daily_grant', amount: 2 },
      transaction
    })

    const balance = Number(await GameCoinLedgerModel.sum('amount', { where: { accountId: user.Account.id }, transaction }) || 0)
    const given = Number(await GameCoinLedgerModel.sum('amount', { where: { accountId: user.Account.id, gameId: game.id, kind: 'spend' }, transaction }) || 0) * -1
    if (given + amount > 2) throw new Error('GAME_COIN_LIMIT')
    if (balance < amount) throw new Error('GAME_COIN_BALANCE')

    await GameCoinLedgerModel.create({
      accountId: user.Account.id,
      gameId: game.id,
      amount: -amount,
      day,
      kind: 'spend'
    }, { transaction })

    return { coinBalance: balance - amount, coinsGiven: given + amount }
  }).catch(error => {
    if (error instanceof Error && error.message === 'GAME_COIN_LIMIT') return { error: 'GAME_COIN_LIMIT' as const }
    if (error instanceof Error && error.message === 'GAME_COIN_BALANCE') return { error: 'GAME_COIN_BALANCE' as const }
    throw error
  })

  if ('error' in result) {
    const message = result.error === 'GAME_COIN_LIMIT' ? '同一游戏最多投币2枚' : '硬币余额不足'
    return res.status(HttpStatusCode.CONFLICT_409).json({ error: message, code: result.error })
  }

  await createGameNotification({
    recipientAccountId: game.ownerAccountId,
    actorAccountId: user.Account.id,
    gameId: game.id,
    kind: 'coin',
    message: `${user.username} 给你的游戏投了 ${result.coinsGiven} 枚硬币`
  })

  awardExp(user.Account.id, 'COIN').catch(() => undefined)

  GameActivityModel.createActivity({
    actorAccountId: user.Account.id,
    gameId: game.id,
    kind: 'coin',
    message: `${user.username} 给游戏《${game.title}》投了 ${result.coinsGiven} 枚硬币`
  }).catch(() => undefined)

  invalidateRecommendationCache(user.Account.id).catch(() => undefined)
  return res.json({ coins: result.coinsGiven, ...result })
}

async function favoriteGame (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (typeof req.body.favorite !== 'boolean') return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'favorite must be boolean' })

  const existing = await GameFavoriteModel.findOne({ where: { gameId: game.id, accountId: user.Account.id } })
  if (req.body.favorite && !existing) await GameFavoriteModel.create({ gameId: game.id, accountId: user.Account.id })
  if (!req.body.favorite && existing) await existing.destroy()

  if (req.body.favorite && !existing && game.ownerAccountId !== user.Account.id) {
    await createGameNotification({
      recipientAccountId: game.ownerAccountId,
      actorAccountId: user.Account.id,
      gameId: game.id,
      kind: 'favorite',
      message: `${user.username} 收藏了你的游戏`
    })
  }

  if (req.body.favorite) {
    awardExp(user.Account.id, 'FAVORITE').catch(() => undefined)

    GameActivityModel.createActivity({
      actorAccountId: user.Account.id,
      gameId: game.id,
      kind: 'favorite',
      message: `${user.username} 收藏了游戏《${game.title}》`
    }).catch(() => undefined)
  }
  invalidateRecommendationCache(user.Account.id).catch(() => undefined)
  return res.json({ favorite: req.body.favorite })
}

async function followAuthor (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (game.ownerAccountId === user.Account.id) return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Cannot follow yourself' })
  if (typeof req.body.following !== 'boolean') return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'following must be boolean' })

  const author = await getGameAuthor(game)
  const target = author?.Actor
  if (!target) return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Game author account is unavailable' })

  const existing = await ActorFollowModel.loadByActorAndTarget(user.Account.Actor.id, target.id)
  if (req.body.following && !existing) {
    JobQueue.Instance.createJobAsync({
      type: 'activitypub-follow',
      payload: {
        name: target.preferredUsername,
        host: null,
        assertIsChannel: false,
        followerActorId: user.Account.Actor.id
      }
    })
  } else if (!req.body.following && existing) {
    await sequelizeTypescript.transaction(async transaction => {
      if (existing.state === 'accepted') sendUndoFollow(existing, transaction)
      await existing.destroy({ transaction })
    })
  }

  if (req.body.following && game.ownerAccountId !== user.Account.id) {
    await createGameNotification({
      recipientAccountId: game.ownerAccountId,
      actorAccountId: user.Account.id,
      gameId: game.id,
      kind: 'follow',
      message: `${user.username} 关注了你`
    })
  }

  return res.json({ following: req.body.following })
}

async function followAccount (req: express.Request, res: express.Response) {
  const user = getUser(res)
  const accountId = Number(req.params.accountId)
  const account = Number.isInteger(accountId) && accountId > 0 ? await AccountModel.load(accountId) : undefined
  if (!account?.Actor) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (typeof req.body.following !== 'boolean') return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'following must be boolean' })
  if (account.id === user.Account.id) return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Cannot follow yourself' })

  const existing = await ActorFollowModel.loadByActorAndTarget(user.Account.Actor.id, account.Actor.id)
  if (req.body.following && !existing) {
    JobQueue.Instance.createJobAsync({
      type: 'activitypub-follow',
      payload: {
        name: account.Actor.preferredUsername,
        host: null,
        assertIsChannel: false,
        followerActorId: user.Account.Actor.id
      }
    })
  } else if (!req.body.following && existing) {
    await sequelizeTypescript.transaction(async transaction => {
      if (existing.state === 'accepted') sendUndoFollow(existing, transaction)
      await existing.destroy({ transaction })
    })
  }

  if (req.body.following) {
    await createGameNotification({
      recipientAccountId: account.id,
      actorAccountId: user.Account.id,
      kind: 'follow',
      message: `${user.username} 关注了你`
    })
  }

  return res.json({ following: req.body.following })
}

async function userRating (accountId: number, gameId: number) {
  const rate = await GameRatingModel.load(accountId, gameId)
  return normalizeGameRating(rate?.type)
}

async function getCoinState (gameId: number, accountId: number) {
  const day = new Date().toISOString().slice(0, 10)
  await GameCoinLedgerModel.findOrCreate({
    where: { accountId, day, kind: 'daily_grant' },
    defaults: { accountId, gameId: null, day, kind: 'daily_grant', amount: 2 }
  })
  const [ balance, given ] = await Promise.all([
    GameCoinLedgerModel.sum('amount', { where: { accountId } }),
    GameCoinLedgerModel.sum('amount', { where: { accountId, gameId, kind: 'spend' } })
  ])
  return { balance: Math.max(0, Number(balance || 0)), given: Math.max(0, Number(given || 0) * -1) }
}

function formatReviews (reviews: GameReviewModel[], game: MGame) {
  return reviews.map(review => ({
    id: review.id,
    score: review.score,
    text: review.text,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    isAuthor: review.accountId === game.ownerAccountId,
    account: review.Account?.toFormattedJSON() || null
  }))
}

async function formatComments (comments: GameCommentModel[], game: MGame, user: any) {
  const commentIds = comments.map(comment => comment.id)
  const [ userReactions, replyCounts ] = await Promise.all([
    user && commentIds.length
      ? GameCommentReactionModel.findAll({ where: { commentId: commentIds, accountId: user.Account.id } })
      : [],
    Promise.all(comments.map(comment => GameCommentModel.count({
      where: { gameId: game.id, inReplyToCommentId: comment.id, deletedAt: null }
    })))
  ])

  const likedCommentIds = new Set(userReactions.map(r => r.commentId))

  return comments.map((comment, index) => {
    const formatted = comment.toFormattedJSON({ totalReplies: replyCounts[index] })
    return {
      ...formatted,
      likes: comment.likeCount,
      liked: !!user && likedCommentIds.has(comment.id),
      isFeatured: comment.isFeatured,
      isAuthor: comment.accountId === game.ownerAccountId,
      canDelete: !!user && canDeleteGameComment({
        commentAccountId: comment.accountId,
        userAccountId: user.Account.id,
        gameOwnerAccountId: game.ownerAccountId,
        canManageAny: user.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT)
      })
    }
  })
}

/**
 * 一键三连：点赞 + 投币(1枚) + 收藏
 * 如果已经操作过则跳过该步骤，不会重复操作
 */
async function tripleAction (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (game.ownerAccountId === user.Account.id) {
    return res.status(HttpStatusCode.FORBIDDEN_403).json({ error: 'Authors cannot triple their own game' })
  }

  const results = { liked: false, coined: false, favorited: false }

  // 1. Like (if not already liked)
  const existingRating = await GameRatingModel.load(user.Account.id, game.id)
  if (!existingRating) {
    await GameRatingModel.create({ accountId: user.Account.id, gameId: game.id, type: 'like' })
    results.liked = true
  }

  // 2. Coin (1 coin, if balance allows and not already given max)
  const day = new Date().toISOString().slice(0, 10)
  await GameCoinLedgerModel.findOrCreate({
    where: { accountId: user.Account.id, day, kind: 'daily_grant' },
    defaults: { accountId: user.Account.id, gameId: null, day, kind: 'daily_grant', amount: 2 }
  })
  const balance = Number(await GameCoinLedgerModel.sum('amount', { where: { accountId: user.Account.id } }) || 0)
  const given = Number(await GameCoinLedgerModel.sum('amount', { where: { accountId: user.Account.id, gameId: game.id, kind: 'spend' } }) || 0) * -1
  if (balance >= 1 && given < 2) {
    await GameCoinLedgerModel.create({ accountId: user.Account.id, gameId: game.id, amount: -1, day, kind: 'spend' })
    results.coined = true
  }

  // 3. Favorite (if not already favorited)
  const existingFavorite = await GameFavoriteModel.findOne({ where: { gameId: game.id, accountId: user.Account.id } })
  if (!existingFavorite) {
    await GameFavoriteModel.create({ gameId: game.id, accountId: user.Account.id })
    results.favorited = true
  }

  // Send notifications for new actions
  if (results.liked) {
    await createGameNotification({
      recipientAccountId: game.ownerAccountId,
      actorAccountId: user.Account.id,
      gameId: game.id,
      kind: 'like',
      message: `${user.username} 赞了你的游戏`
    })
  }
  if (results.coined) {
    await createGameNotification({
      recipientAccountId: game.ownerAccountId,
      actorAccountId: user.Account.id,
      gameId: game.id,
      kind: 'coin',
      message: `${user.username} 给你的游戏投了硬币`
    })
  }
  if (results.favorited) {
    await createGameNotification({
      recipientAccountId: game.ownerAccountId,
      actorAccountId: user.Account.id,
      gameId: game.id,
      kind: 'favorite',
      message: `${user.username} 收藏了你的游戏`
    })
  }

  awardExp(user.Account.id, 'TRIPLE').catch(() => undefined)
  invalidateRecommendationCache(user.Account.id).catch(() => undefined)
  return res.json(results)
}

/**
 * 解析评论排序参数，默认 new
 */
function parseCommentSort (sort: string | undefined): CommentSortOption {
  if (sort === 'hot' || sort === 'new' || sort === 'old') return sort
  return 'new'
}

/**
 * 根据排序选项生成 Sequelize order 子句
 * hot: 精选优先，然后按点赞数降序，再按时间降序
 * new: 按创建时间降序
 * old: 按创建时间升序
 */
function getCommentSortOrder (sort: CommentSortOption): OrderItem[] {
  switch (sort) {
    case 'hot':
      return [
        [ 'isFeatured', 'DESC' ],
        [ 'likeCount', 'DESC' ],
        [ 'createdAt', 'DESC' ]
      ]
    case 'new':
      return [ [ 'createdAt', 'DESC' ] ]
    case 'old':
      return [ [ 'createdAt', 'ASC' ] ]
  }
}

type OrderItem = [ string, string ] | [ string, string, string ]

/**
 * 获取游戏的精选评论列表
 */
async function listFeaturedComments (req: express.Request, res: express.Response) {
  return traceGameOperation('listFeaturedComments', async () => {
    const game = await getPublishedGame(req)
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const start = Math.max(0, Number(req.query.start) || 0)
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 20))

    const where = { gameId: game.id, inReplyToCommentId: null, deletedAt: null, isFeatured: true }
    const [ total, comments ] = await Promise.all([
      GameCommentModel.count({ where }),
      GameCommentModel.findAll({
        where,
        include: [ commentAccountInclude ],
        order: [ [ 'likeCount', 'DESC' ], [ 'createdAt', 'DESC' ] ],
        limit: count,
        offset: start
      })
    ])

    return res.json({ total, data: await formatComments(comments, game, getUser(res)) })
  })
}
