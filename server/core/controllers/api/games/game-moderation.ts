import { HttpStatusCode } from '@peertube/peertube-models'
import { GameAuditView, auditLoggerFactory, getAuditIdFromRes } from '@server/helpers/audit-logger.js'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { createGameNotification } from '@server/lib/games/game-notifications.js'
import { getModerationStatus, isGameModerator } from '@server/lib/games/game-policy.js'
import { GameModel } from '@server/models/game/game.js'
import { GameReportModel } from '@server/models/game/game-report.js'
import { asyncMiddleware, authenticate } from '@server/middlewares/index.js'
import { gameModerationValidator, gameUUIDValidator } from '@server/middlewares/validators/games.js'
import express from 'express'
import { getUser, formatGame } from './game-shared.js'

const auditLogger = auditLoggerFactory('games')

const moderationRouter = express.Router()

moderationRouter.post('/:uuid/report', gameUUIDValidator, authenticate, asyncMiddleware(reportGame))
moderationRouter.post('/:uuid/moderate', authenticate, gameModerationValidator, asyncMiddleware(moderateGame))
moderationRouter.put('/:uuid/featured', authenticate, gameUUIDValidator, asyncMiddleware(setFeatured))

export { moderationRouter }

async function moderateGame (req: express.Request, res: express.Response) {
  return traceGameOperation('moderateGame', async () => {
    const user = getUser(res)
    if (!user || !isGameModerator(user)) return res.sendStatus(HttpStatusCode.FORBIDDEN_403)

    const game = await GameModel.loadByUUID(req.params.uuid)
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const status = getModerationStatus(req.body.action, game.status)
    if (!status) return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Invalid game moderation transition' })

    const oldGame = formatGame(game)
    game.status = status
    game.moderationReason = req.body.reason || null
    game.moderatedByAccountId = user.Account.id
    game.moderatedAt = new Date()
    game.publishedAt = status === 'published' ? new Date() : null
    await game.save()
    if (game.ownerAccountId !== user.Account.id) {
      await createGameNotification({
        recipientAccountId: game.ownerAccountId,
        actorAccountId: user.Account.id,
        gameId: game.id,
        kind: 'moderation',
        message: `你的游戏审核状态已更新为：${status}`
      })
    }

    auditLogger.update(getAuditIdFromRes(res), new GameAuditView(formatGame(game)), new GameAuditView(oldGame))

    return res.json(formatGame(game))
  })
}

/**
 * 管理员设置/取消精选 — 仅管理员和版主可操作
 */
async function setFeatured (req: express.Request, res: express.Response) {
  return traceGameOperation('setFeatured', async () => {
    const user = getUser(res)
    if (!user || !isGameModerator(user)) return res.sendStatus(HttpStatusCode.FORBIDDEN_403)

    const game = await GameModel.loadByUUID(req.params.uuid)
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    if (typeof req.body.featured !== 'boolean') {
      return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'featured must be boolean' })
    }

    game.featured = req.body.featured
    game.featuredAt = req.body.featured ? new Date() : null
    await game.save()

    return res.json({ featured: game.featured, featuredAt: game.featuredAt })
  })
}

/**
 * 举报游戏
 */
async function reportGame (req: express.Request, res: express.Response) {
  return traceGameOperation('reportGame', async () => {
    const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const user = getUser(res)
    const reason = String(req.body.reason || '').trim()
    if (!reason) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'reason is required' })

    const predefinedReasons = Array.isArray(req.body.predefinedReasons)
      ? req.body.predefinedReasons.filter((r: unknown) => typeof r === 'string').slice(0, 10)
      : []

    const report = await GameReportModel.create({
      reporterAccountId: user.Account.id,
      gameId: game.id,
      commentId: null,
      reason,
      state: 'pending',
      predefinedReasons
    })

    return res.status(HttpStatusCode.CREATED_201).json({
      id: report.id,
      state: report.state,
      createdAt: report.createdAt
    })
  })
}
