import { HttpStatusCode } from '@peertube/peertube-models'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { JobQueue } from '@server/lib/job-queue/index.js'
import { sendUndoFollow } from '@server/lib/activitypub/send/index.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { GameFavoriteModel } from '@server/models/game/game-favorite.js'
import { GameCoinLedgerModel } from '@server/models/game/game-coin-ledger.js'
import { GameRatingModel, type GameRatingType } from '@server/models/game/game-rating.js'
import { GameActivityModel } from '@server/models/game/game-activity.js'
import { asyncMiddleware, authenticate, gameCoinRateLimiter, gameFavoriteRateLimiter, gameRatingRateLimiter } from '@server/middlewares/index.js'
import { gameUUIDValidator } from '@server/middlewares/validators/games.js'
import express from 'express'
import { isSupportedGameRating, normalizeGameRating } from '@server/lib/games/game-community-policy.js'
import { createGameNotification } from '@server/lib/games/game-notifications.js'
import { invalidateRecommendationCache } from '@server/lib/games/game-recommendations.js'
import { awardExp } from '@server/lib/games/game-exp.js'
import { getGameAuthor, getPublishedGame, getUser } from './community-shared.js'

const communityInteractionsRouter = express.Router()

communityInteractionsRouter.put('/:uuid/rate', gameUUIDValidator, authenticate, gameRatingRateLimiter, asyncMiddleware(rateGame))
communityInteractionsRouter.put('/:uuid/favorite', gameUUIDValidator, authenticate, gameFavoriteRateLimiter, asyncMiddleware(favoriteGame))
communityInteractionsRouter.put('/:uuid/follow', gameUUIDValidator, authenticate, asyncMiddleware(followAuthor))
communityInteractionsRouter.put('/author/:accountId/follow', authenticate, asyncMiddleware(followAccount))
communityInteractionsRouter.post('/:uuid/coin', gameUUIDValidator, authenticate, gameCoinRateLimiter, asyncMiddleware(coinGame))
communityInteractionsRouter.post('/:uuid/triple', gameUUIDValidator, authenticate, gameRatingRateLimiter, asyncMiddleware(tripleAction))

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

export { communityInteractionsRouter, userRating, getCoinState }
