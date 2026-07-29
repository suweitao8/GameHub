import { HttpStatusCode } from '@peertube/peertube-models'
import { GameModel } from '@server/models/game/game.js'
import { GameNotificationModel } from '@server/models/game/game-notification.js'
import { AccountModel } from '@server/models/account/account.js'
import { asyncMiddleware, authenticate } from '@server/middlewares/index.js'
import express from 'express'
import { getUser, formatGameNotification } from './game-shared.js'

const personalNotificationsRouter = express.Router()

personalNotificationsRouter.get('/me/notifications', authenticate, asyncMiddleware(listGameNotifications))
personalNotificationsRouter.put('/me/notifications/:notificationId/read', authenticate, asyncMiddleware(markGameNotificationRead))
personalNotificationsRouter.post('/me/notifications/read-all', authenticate, asyncMiddleware(markAllGameNotificationsRead))
personalNotificationsRouter.delete('/me/notifications/:notificationId', authenticate, asyncMiddleware(deleteGameNotification))

export { personalNotificationsRouter }

async function listGameNotifications (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  const where = { recipientAccountId: user.Account.id }
  const [ total, unread, data ] = await Promise.all([
    GameNotificationModel.count({ where }),
    GameNotificationModel.count({ where: { ...where, readAt: null } }),
    GameNotificationModel.findAll({
      where,
      include: [
        { model: AccountModel, as: 'Actor', required: false },
        { model: GameModel, required: false }
      ],
      order: [ [ 'createdAt', 'DESC' ] ],
      limit: 100
    })
  ])

  return res.json({ total, unread, data: data.map(formatGameNotification) })
}

async function markGameNotificationRead (req: express.Request, res: express.Response) {
  const user = getUser(res)
  const notification = await GameNotificationModel.findOne({
    where: { id: Number(req.params.notificationId), recipientAccountId: user.Account.id }
  })
  if (!notification) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  notification.readAt = notification.readAt || new Date()
  await notification.save()
  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function markAllGameNotificationsRead (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  await GameNotificationModel.update(
    { readAt: new Date() },
    { where: { recipientAccountId: user.Account.id, readAt: null } }
  )
  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

/**
 * 删除单条游戏通知
 */
async function deleteGameNotification (req: express.Request, res: express.Response) {
  const user = getUser(res)
  const notification = await GameNotificationModel.findOne({
    where: { id: Number(req.params.notificationId), recipientAccountId: user.Account.id }
  })
  if (!notification) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  await notification.destroy()
  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}
