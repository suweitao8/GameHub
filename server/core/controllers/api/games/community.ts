import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { abusePredefinedReasonsMap } from '@peertube/peertube-core-utils'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { JobQueue } from '@server/lib/job-queue/index.js'
import { sendUndoFollow } from '@server/lib/activitypub/send/index.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { GameFavoriteModel } from '@server/models/game/game-favorite.js'
import { GameCoinLedgerModel } from '@server/models/game/game-coin-ledger.js'
import { GameCommentReactionModel } from '@server/models/game/game-comment-reaction.js'
import { GameCommentModel } from '@server/models/game/game-comment.js'
import { GameRatingModel, type GameRatingType } from '@server/models/game/game-rating.js'
import { GameReportModel } from '@server/models/game/game-report.js'
import { GameModel } from '@server/models/game/game.js'
import type { MGame } from '@server/types/models/game/game.js'
import { apiRateLimiter, asyncMiddleware, authenticate, optionalAuthenticate } from '@server/middlewares/index.js'
import { gameUUIDValidator } from '@server/middlewares/validators/games.js'
import express from 'express'
import { canDeleteGameComment } from '../../../lib/games/game-community-policy.js'
import { createGameNotification } from '../../../lib/games/game-notifications.js'

const gameCommunityRouter = express.Router()
gameCommunityRouter.use(apiRateLimiter)

gameCommunityRouter.get('/:uuid/community', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(getCommunity))
gameCommunityRouter.get('/:uuid/comments', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(listComments))
gameCommunityRouter.get('/:uuid/comments/:commentId/replies', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(listReplies))
gameCommunityRouter.post('/:uuid/comments', gameUUIDValidator, authenticate, asyncMiddleware(addComment))
gameCommunityRouter.post('/:uuid/comments/:commentId/reply', gameUUIDValidator, authenticate, asyncMiddleware(replyToComment))
gameCommunityRouter.put('/:uuid/comments/:commentId/like', gameUUIDValidator, authenticate, asyncMiddleware(likeComment))
gameCommunityRouter.delete('/:uuid/comments/:commentId', gameUUIDValidator, authenticate, asyncMiddleware(deleteComment))
gameCommunityRouter.post('/:uuid/comments/:commentId/report', gameUUIDValidator, authenticate, asyncMiddleware(reportComment))
gameCommunityRouter.put('/:uuid/rate', gameUUIDValidator, authenticate, asyncMiddleware(rateGame))
gameCommunityRouter.put('/:uuid/favorite', gameUUIDValidator, authenticate, asyncMiddleware(favoriteGame))
gameCommunityRouter.put('/:uuid/follow', gameUUIDValidator, authenticate, asyncMiddleware(followAuthor))
gameCommunityRouter.put('/author/:accountId/follow', authenticate, asyncMiddleware(followAccount))
gameCommunityRouter.post('/:uuid/coin', gameUUIDValidator, authenticate, asyncMiddleware(coinGame))
gameCommunityRouter.post('/:uuid/report', gameUUIDValidator, authenticate, asyncMiddleware(reportGame))

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
  const game = await getPublishedGame(req)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const author = await getGameAuthor(game)
  const user = getUser(res)
  const following = author?.Actor && user
    ? !!await ActorFollowModel.loadByActorAndTarget(user.Account.Actor.id, author.Actor.id)
    : false
  const favorite = user
    ? !!await GameFavoriteModel.findOne({ where: { gameId: game.id, accountId: user.Account.id } })
    : false
  const rating = user ? await userRating(user.Account.id, game.id) : null
  const [ likes, dislikes ] = await Promise.all([
    GameRatingModel.count({ where: { gameId: game.id, type: 'like' } }),
    GameRatingModel.count({ where: { gameId: game.id, type: 'dislike' } })
  ])
  const coinState = user ? await getCoinState(game.id, user.Account.id) : { balance: 0, given: 0 }
  const totalCoins = Number(await GameCoinLedgerModel.sum('amount', { where: { gameId: game.id, kind: 'spend' } }) || 0) * -1

  return res.json({
    isOwner: !!user && user.Account.id === game.ownerAccountId,
    likes,
    dislikes,
    comments: await GameCommentModel.count({ where: { gameId: game.id, deletedAt: null } }),
    rating,
    favorite,
    following,
    coins: Math.max(0, totalCoins),
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
}

async function listComments (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const where = { gameId: game.id, inReplyToCommentId: null, deletedAt: null }
  const [ total, comments ] = await Promise.all([
    GameCommentModel.count({ where }),
    GameCommentModel.findAll({
      where,
      include: [ commentAccountInclude ],
      order: [ [ 'createdAt', 'ASC' ] ],
      limit: 20
    })
  ])

  return res.json({ total, data: await formatComments(comments, game, getUser(res)) })
}

async function listReplies (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const commentId = Number(req.params.commentId)
  if (!game || !Number.isInteger(commentId)) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const parent = await getCommentForGame(game, commentId)
  if (!parent) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const where = { gameId: game.id, inReplyToCommentId: commentId, deletedAt: null }
  const [ total, comments ] = await Promise.all([
    GameCommentModel.count({ where }),
    GameCommentModel.findAll({
      where,
      include: [ commentAccountInclude ],
      order: [ [ 'createdAt', 'ASC' ] ],
      limit: 100
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
  return res.status(HttpStatusCode.CREATED_201).json({ comment: (await formatComments([ hydratedComment ], game, user))[0] })
}

async function likeComment (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  const comment = await getCommentForGame(game, Number(req.params.commentId))
  if (!game || !comment) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (typeof req.body.liked !== 'boolean') return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'liked must be boolean' })

  const existing = await GameCommentReactionModel.findOne({ where: { commentId: comment.id, accountId: user.Account.id } })
  if (req.body.liked && !existing) await GameCommentReactionModel.create({ commentId: comment.id, accountId: user.Account.id })
  if (!req.body.liked && existing) await existing.destroy()

  const likes = await GameCommentReactionModel.count({ where: { commentId: comment.id } })
  return res.json({ liked: req.body.liked, likes })
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

async function reportComment (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  const comment = await getCommentForGame(game, Number(req.params.commentId))
  if (!game || !comment) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (typeof req.body.reason !== 'string' || req.body.reason.trim().length === 0) {
    return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'reason is required' })
  }

  const result = await GameReportModel.create({
    reporterAccountId: user.Account.id,
    gameId: game.id,
    commentId: comment.id,
    reason: req.body.reason.trim(),
    state: 'pending',
    predefinedReasons: req.body.predefinedReasons?.map((reason: string) => abusePredefinedReasonsMap[reason]).filter(Boolean) || null
  })

  return res.status(HttpStatusCode.CREATED_201).json({ abuse: { id: result.id } })
}

async function rateGame (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (game.ownerAccountId === user.Account.id) return res.status(HttpStatusCode.FORBIDDEN_403).json({ error: 'Authors cannot rate their own game' })
  if (!['like', 'dislike', 'none'].includes(req.body.rating)) {
    return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'rating must be like, dislike or none' })
  }

  await sequelizeTypescript.transaction(async transaction => {
    const previous = await GameRatingModel.load(user.Account.id, game.id, transaction)
    if (req.body.rating === 'none') {
      if (previous) await previous.destroy({ transaction })
      return
    }

    if (previous) {
      previous.type = req.body.rating as GameRatingType
      await previous.save({ transaction })
      return
    }

    await GameRatingModel.create({
      accountId: user.Account.id,
      gameId: game.id,
      type: req.body.rating as GameRatingType
    }, { transaction })
  })
  if (req.body.rating === 'like') {
    await createGameNotification({
      recipientAccountId: game.ownerAccountId,
      actorAccountId: user.Account.id,
      gameId: game.id,
      kind: 'like',
      message: `${user.username} 赞了你的游戏`
    })
  }
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

async function reportGame (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (typeof req.body.reason !== 'string' || req.body.reason.trim().length === 0) {
    return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'reason is required' })
  }

  const result = await GameReportModel.create({
    reporterAccountId: user.Account.id,
    gameId: game.id,
    commentId: null,
    reason: req.body.reason.trim(),
    state: 'pending',
    predefinedReasons: req.body.predefinedReasons?.map((reason: string) => abusePredefinedReasonsMap[reason]).filter(Boolean) || null
  })

  return res.status(HttpStatusCode.CREATED_201).json({ abuse: { id: result.id } })
}

async function userRating (accountId: number, gameId: number) {
  const rate = await GameRatingModel.load(accountId, gameId)
  return rate?.type || 'none'
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

async function formatComments (comments: GameCommentModel[], game: MGame, user: any) {
  const commentIds = comments.map(comment => comment.id)
  const [ reactions, replyCounts ] = await Promise.all([
    commentIds.length
      ? GameCommentReactionModel.findAll({ where: { commentId: commentIds } })
      : [],
    Promise.all(comments.map(comment => GameCommentModel.count({
      where: { gameId: game.id, inReplyToCommentId: comment.id, deletedAt: null }
    })))
  ])

  return comments.map((comment, index) => {
    const formatted = comment.toFormattedJSON({ totalReplies: replyCounts[index] })
    const commentReactions = reactions.filter(reaction => reaction.commentId === comment.id)
    return {
      ...formatted,
      likes: commentReactions.length,
      liked: !!user && commentReactions.some(reaction => reaction.accountId === user.Account.id),
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
