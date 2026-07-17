import { AbuseState, HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { abusePredefinedReasonsMap } from '@peertube/peertube-core-utils'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { createVideoAbuse } from '@server/lib/moderation.js'
import { JobQueue } from '@server/lib/job-queue/index.js'
import { createLocalVideoComment } from '@server/lib/video-comment.js'
import { sendUndoFollow } from '@server/lib/activitypub/send/index.js'
import { userRateVideo } from '@server/lib/rate.js'
import { Notifier } from '@server/lib/notifier/index.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { GameFavoriteModel } from '@server/models/game/game-favorite.js'
import { GameCoinLedgerModel } from '@server/models/game/game-coin-ledger.js'
import { GameModel } from '@server/models/game/game.js'
import type { MGame } from '@server/types/models/game/game.js'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { VideoModel } from '@server/models/video/video.js'
import { apiRateLimiter, asyncMiddleware, authenticate, optionalAuthenticate } from '@server/middlewares/index.js'
import { gameUUIDValidator } from '@server/middlewares/validators/games.js'
import express from 'express'
import { ensureGameVideo } from '../../../lib/games/game-video-bridge.js'

const gameCommunityRouter = express.Router()
gameCommunityRouter.use(apiRateLimiter)

gameCommunityRouter.get('/:uuid/community', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(getCommunity))
gameCommunityRouter.get('/:uuid/comments', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(listComments))
gameCommunityRouter.post('/:uuid/comments', gameUUIDValidator, authenticate, asyncMiddleware(addComment))
gameCommunityRouter.post('/:uuid/comments/:commentId/reply', gameUUIDValidator, authenticate, asyncMiddleware(replyToComment))
gameCommunityRouter.put('/:uuid/rate', gameUUIDValidator, authenticate, asyncMiddleware(rateGame))
gameCommunityRouter.put('/:uuid/favorite', gameUUIDValidator, authenticate, asyncMiddleware(favoriteGame))
gameCommunityRouter.put('/:uuid/follow', gameUUIDValidator, authenticate, asyncMiddleware(followAuthor))
gameCommunityRouter.post('/:uuid/coin', gameUUIDValidator, authenticate, asyncMiddleware(coinGame))
gameCommunityRouter.post('/:uuid/report', gameUUIDValidator, authenticate, asyncMiddleware(reportGame))

export { gameCommunityRouter }

async function getPublishedGame (req: express.Request) {
  return GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
}

function getUser (res: express.Response) {
  return res.locals.oauth?.token.User
}

async function getVideoForGame (game: MGame) {
  const video = await ensureGameVideo(game)
  return video ? VideoModel.loadFull(video.id) : null
}

async function getCommunity (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const video = await getVideoForGame(game)
  const user = getUser(res)
  const following = video?.VideoChannel?.Actor && user
    ? !!await ActorFollowModel.loadByActorAndTarget(user.Account.Actor.id, video.VideoChannel.Actor.id)
    : false
  const favorite = user
    ? !!await GameFavoriteModel.findOne({ where: { gameId: game.id, accountId: user.Account.id } })
    : false
  const rating = user && video ? await userRating(user.Account.id, video.id) : null
  const coinState = user ? await getCoinState(game.id, user.Account.id) : { balance: 0, given: 0 }
  const totalCoins = Number(await GameCoinLedgerModel.sum('amount', { where: { gameId: game.id, kind: 'spend' } }) || 0) * -1

  return res.json({
    videoUuid: video?.uuid || null,
    likes: video?.likes || 0,
    dislikes: video?.dislikes || 0,
    comments: video?.comments || 0,
    rating,
    favorite,
    following,
    coins: Math.max(0, totalCoins),
    coinBalance: coinState.balance,
    coinsGiven: coinState.given,
    author: video?.VideoChannel
      ? {
          id: video.VideoChannel.id,
          name: video.VideoChannel.name,
          displayName: video.VideoChannel.name,
          handle: video.VideoChannel.Actor?.getIdentifier()
        }
      : null
  })
}

async function listComments (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const video = await getVideoForGame(game)
  if (!video) return res.json({ total: 0, data: [] })

  const result = await VideoCommentModel.listThreadsForApi({
    video,
    start: 0,
    count: 20,
    sort: 'createdAt',
    user: getUser(res)
  })

  return res.json({ total: result.total, data: result.data.map(comment => comment.toFormattedJSON()) })
}

async function addComment (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (typeof req.body.text !== 'string' || req.body.text.trim().length === 0 || req.body.text.length > 5000) {
    return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'text must contain 1-5000 characters' })
  }

  const video = await getVideoForGame(game)
  if (!video) return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Game author has no video channel' })

  const comment = await createLocalVideoComment({
    text: req.body.text.trim(),
    inReplyToComment: null,
    video,
    user
  })
  Notifier.Instance.notifyOnNewComment(comment)

  return res.status(HttpStatusCode.CREATED_201).json({ comment: comment.toFormattedJSON() })
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
  const video = await getVideoForGame(game)
  const parent = await VideoCommentModel.loadByIdAndPopulateVideoAndAccountAndReply(commentId)
  if (!video || !parent || parent.Video.id !== video.id) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const comment = await createLocalVideoComment({ text, inReplyToComment: parent, video, user })
  Notifier.Instance.notifyOnNewComment(comment)
  return res.status(HttpStatusCode.CREATED_201).json({ comment: comment.toFormattedJSON() })
}

async function rateGame (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (game.ownerAccountId === user.Account.id) return res.status(HttpStatusCode.FORBIDDEN_403).json({ error: 'Authors cannot rate their own game' })
  if (!['like', 'dislike', 'none'].includes(req.body.rating)) {
    return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'rating must be like, dislike or none' })
  }

  const video = await getVideoForGame(game)
  if (!video) return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Game author has no video channel' })

  await userRateVideo({ account: user.Account, rateType: req.body.rating, video })
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

  return res.json({ favorite: req.body.favorite })
}

async function followAuthor (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (typeof req.body.following !== 'boolean') return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'following must be boolean' })

  const video = await getVideoForGame(game)
  const target = video?.VideoChannel?.Actor
  if (!target) return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Game author has no video channel' })

  const existing = await ActorFollowModel.loadByActorAndTarget(user.Account.Actor.id, target.id)
  if (req.body.following && !existing) {
    JobQueue.Instance.createJobAsync({
      type: 'activitypub-follow',
      payload: {
        name: target.preferredUsername,
        host: null,
        assertIsChannel: true,
        followerActorId: user.Account.Actor.id
      }
    })
  } else if (!req.body.following && existing) {
    await sequelizeTypescript.transaction(async transaction => {
      if (existing.state === 'accepted') sendUndoFollow(existing, transaction)
      await existing.destroy({ transaction })
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

  const video = await getVideoForGame(game)
  if (!video) return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Game author has no video channel' })

  const result = await sequelizeTypescript.transaction(async transaction => {
    const reporterAccount = await AccountModel.load(user.Account.id, transaction)
    return createVideoAbuse({
      baseAbuse: {
        reporterAccountId: reporterAccount.id,
        reason: req.body.reason.trim(),
        state: AbuseState.PENDING,
        predefinedReasons: req.body.predefinedReasons?.map((reason: string) => abusePredefinedReasonsMap[reason])
      },
      videoInstance: video,
      reporterAccount,
      transaction,
      startAt: null,
      endAt: null,
      skipNotification: user.hasRight(UserRight.MANAGE_ABUSES)
    })
  })

  return res.status(HttpStatusCode.CREATED_201).json({ abuse: { id: result.id } })
}

async function userRating (accountId: number, videoId: number) {
  const rate = await import('@server/models/account/account-video-rate.js').then(({ AccountVideoRateModel }) => {
    return AccountVideoRateModel.load(accountId, videoId)
  })
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
