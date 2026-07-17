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
gameCommunityRouter.put('/:uuid/rate', gameUUIDValidator, authenticate, asyncMiddleware(rateGame))
gameCommunityRouter.put('/:uuid/favorite', gameUUIDValidator, authenticate, asyncMiddleware(favoriteGame))
gameCommunityRouter.put('/:uuid/follow', gameUUIDValidator, authenticate, asyncMiddleware(followAuthor))
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

  return res.json({
    videoUuid: video?.uuid || null,
    likes: video?.likes || 0,
    dislikes: video?.dislikes || 0,
    comments: video?.comments || 0,
    rating,
    favorite,
    following,
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

async function rateGame (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (!['like', 'dislike', 'none'].includes(req.body.rating)) {
    return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'rating must be like, dislike or none' })
  }

  const video = await getVideoForGame(game)
  if (!video) return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Game author has no video channel' })

  await userRateVideo({ account: user.Account, rateType: req.body.rating, video })
  return res.status(HttpStatusCode.NO_CONTENT_204).end()
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
