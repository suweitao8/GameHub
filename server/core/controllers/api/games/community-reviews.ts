import { HttpStatusCode } from '@peertube/peertube-models'
import { awardExp } from '@server/lib/games/game-exp.js'
import { createGameNotification } from '@server/lib/games/game-notifications.js'
import { GameActivityModel } from '@server/models/game/game-activity.js'
import { GameReviewModel } from '@server/models/game/game-review.js'
import type { MGame } from '@server/types/models/game/game.js'
import { asyncMiddleware, authenticate, gameReviewRateLimiter, optionalAuthenticate } from '@server/middlewares/index.js'
import { gameUUIDValidator } from '@server/middlewares/validators/games.js'
import express from 'express'
import { commentAccountInclude, getPublishedGame, getUser } from './community-shared.js'

const communityReviewsRouter = express.Router()

communityReviewsRouter.get('/:uuid/rating-distribution', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(getRatingDistribution))
communityReviewsRouter.get('/:uuid/reviews', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(listReviews))
communityReviewsRouter.put('/:uuid/review', gameUUIDValidator, authenticate, gameReviewRateLimiter, asyncMiddleware(upsertReview))

export { communityReviewsRouter }

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
  }) as unknown as { score: number, count: number }[]

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
