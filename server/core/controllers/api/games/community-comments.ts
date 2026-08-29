import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { mkdir, readFile, rename, unlink } from 'fs/promises'
import { basename, dirname, extname, join, resolve } from 'path'
import { awardExp } from '@server/lib/games/game-exp.js'
import { canDeleteGameComment } from '@server/lib/games/game-community-policy.js'
import { createGameNotification } from '@server/lib/games/game-notifications.js'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { CONFIG } from '@server/initializers/config.js'
import { createReqFiles } from '@server/helpers/express-utils.js'
import { GameActivityModel } from '@server/models/game/game-activity.js'
import { GameCommentReactionModel } from '@server/models/game/game-comment-reaction.js'
import { GameCommentModel } from '@server/models/game/game-comment.js'
import type { MGame } from '@server/types/models/game/game.js'
import type { MUserAccountUrl } from '@server/types/models/user/user.js'
import { asyncMiddleware, authenticate, gameCommentRateLimiter, gameRatingRateLimiter, optionalAuthenticate } from '@server/middlewares/index.js'
import { gameUUIDValidator } from '@server/middlewares/validators/games.js'
import express from 'express'
import { type WhereOptions } from 'sequelize'
import { commentAccountInclude, type CommentSortOption, getPublishedGame, getUser } from './community-shared.js'

type OrderItem = [ string, string ] | [ string, string, string ]

const communityCommentsRouter = express.Router()
const commentImageUpload = createReqFiles([ 'image' ], {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif'
})
const MAX_COMMENT_IMAGE_BYTES = 5 * 1024 * 1024
const COMMENT_IMAGE_TOO_LARGE_MESSAGE = 'Comment image cannot exceed 5 MB'

communityCommentsRouter.get('/:uuid/comments/featured', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(listFeaturedComments))
communityCommentsRouter.get('/:uuid/comments', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(listComments))
communityCommentsRouter.get('/:uuid/comments/:commentId/image', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(getCommentImage))
communityCommentsRouter.get('/:uuid/comments/:commentId/replies', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(listReplies))
communityCommentsRouter.post('/:uuid/comments', gameUUIDValidator, authenticate, commentImageUpload, gameCommentRateLimiter, asyncMiddleware(addComment))
communityCommentsRouter.post('/:uuid/comments/:commentId/reply', gameUUIDValidator, authenticate, commentImageUpload, gameCommentRateLimiter, asyncMiddleware(replyToComment))
communityCommentsRouter.put('/:uuid/comments/:commentId/like', gameUUIDValidator, authenticate, gameRatingRateLimiter, asyncMiddleware(likeComment))
communityCommentsRouter.delete('/:uuid/comments/:commentId', gameUUIDValidator, authenticate, asyncMiddleware(deleteComment))

export { communityCommentsRouter }

async function getCommentForGame (game: MGame | null, commentId: number, includeDeleted = false) {
  if (!game || !Number.isInteger(commentId)) return null

  // deletedAt is an optional column filter; spread conditionally to keep the object a
  // single literal rather than mutating a Record (which would force a wider type).
  const where: WhereOptions = {
    gameId: game.id,
    id: commentId,
    ...(!includeDeleted ? { deletedAt: null } : {})
  }

  return GameCommentModel.findOne({
    where,
    include: [ commentAccountInclude ]
  })
}

async function storeCommentImage (game: MGame, req: express.Request) {
  const file = req.files?.['image']?.[0]
  if (!file) return null
  if (file.size > MAX_COMMENT_IMAGE_BYTES) {
    await unlink(file.path).catch(() => undefined)
    throw new Error(COMMENT_IMAGE_TOO_LARGE_MESSAGE)
  }

  const extension = extname(file.filename).toLowerCase()
  const relativePath = join('comments', game.uuid, `${basename(file.filename, extension)}${extension}`).replaceAll('\\', '/')
  const targetPath = join(CONFIG.STORAGE.GAMES_DIR, relativePath)
  await mkdir(dirname(targetPath), { recursive: true })
  await rename(file.path, targetPath)
  return relativePath
}

async function getCommentImage (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const comment = await getCommentForGame(game, Number(req.params.commentId))
  if (!game || !comment?.imagePath) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const root = resolve(CONFIG.STORAGE.GAMES_DIR)
  const imagePath = resolve(root, comment.imagePath)
  if (imagePath !== root && !imagePath.startsWith(root + '\\')) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  try {
    const content = await readFile(imagePath)
    return res.type(extname(imagePath)).send(content)
  } catch {
    return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  }
}

async function listComments (req: express.Request, res: express.Response) {
  return traceGameOperation('listComments', async () => {
    const game = await getPublishedGame(req)
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const start = Math.max(0, Number(req.query.start) || 0)
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 20))
    const sort = parseCommentSort(req.query.sort as string)

    const where = { gameId: game.id, inReplyToCommentId: null, deletedAt: null }
    const allCommentsWhere = { gameId: game.id, deletedAt: null }
    const order = getCommentSortOrder(sort)

    const [ total, commentCount, comments ] = await Promise.all([
      GameCommentModel.count({ where }),
      GameCommentModel.count({ where: allCommentsWhere }),
      GameCommentModel.findAll({
        where,
        include: [ commentAccountInclude ],
        order,
        limit: count,
        offset: start
      })
    ])

    return res.json({ total, commentCount, data: await formatComments(comments, game, getUser(res)) })
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
    return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: req.t('text must contain 1-5000 characters') })
  }

  let imagePath: string | null
  try {
    imagePath = await storeCommentImage(game, req)
  } catch (error) {
    const errorMessage = error instanceof Error && error.message === COMMENT_IMAGE_TOO_LARGE_MESSAGE
      ? req.t(COMMENT_IMAGE_TOO_LARGE_MESSAGE)
      : req.t('Comment image upload failed')
    return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: errorMessage })
  }

  const comment = await GameCommentModel.create({
    gameId: game.id,
    accountId: user.Account.id,
    inReplyToCommentId: null,
    text: req.body.text.trim(),
    imagePath,
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
    return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: req.t('text and commentId are required') })
  }
  const parent = await getCommentForGame(game, commentId)
  if (!parent) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  let imagePath: string | null
  try {
    imagePath = await storeCommentImage(game, req)
  } catch (error) {
    const errorMessage = error instanceof Error && error.message === COMMENT_IMAGE_TOO_LARGE_MESSAGE
      ? req.t(COMMENT_IMAGE_TOO_LARGE_MESSAGE)
      : req.t('Comment image upload failed')
    return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: errorMessage })
  }

  const comment = await GameCommentModel.create({
    gameId: game.id,
    accountId: user.Account.id,
    inReplyToCommentId: parent.id,
    text,
    imagePath,
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
    if (typeof req.body.liked !== 'boolean') return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: req.t('liked must be boolean') })

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

async function formatComments (comments: GameCommentModel[], game: MGame, user: MUserAccountUrl | undefined) {
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
      imageUrl: comment.imagePath ? `/api/v1/games/${game.uuid}/comments/${comment.id}/image` : null,
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
