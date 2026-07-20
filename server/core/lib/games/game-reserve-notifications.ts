import { logger } from '@server/helpers/logger.js'
import { AccountModel } from '@server/models/account/account.js'
import { GameModel } from '@server/models/game/game.js'
import { GameReserveModel } from '@server/models/game/game-reserve.js'
import { createGameNotification } from './game-notifications.js'
import { Redis } from '@server/lib/redis.js'

const NOTIFICATION_LOCK_KEY = 'game-reserve-notification-lock'
const NOTIFICATION_LOCK_TTL_MS = 60 * 1000 // 1 minute

/**
 * 通知预约用户游戏已发布
 * 通过定时任务调用
 */
export async function notifyReservationsForReleasedGames (): Promise<number> {
  const client = Redis.Instance.getClient()
  const prefix = Redis.Instance.getPrefix()

  // 分布式锁，防止多实例重复通知
  const lockAcquired = await client.set(prefix + NOTIFICATION_LOCK_KEY, '1', 'PX', NOTIFICATION_LOCK_TTL_MS, 'NX')
  if (!lockAcquired) return 0

  try {
    // 查找已发布但用户未收到通知的预约
    const rows = await GameReserveModel.findAll({
      where: { notified: false },
      include: [
        {
          model: GameModel,
          where: { status: 'published', publishedAt: { not: null } },
          required: true,
          include: [ { model: AccountModel, required: true } ]
        }
      ],
      limit: 100
    })

    let notifiedCount = 0

    for (const reserve of rows) {
      const game = reserve.Game
      await createGameNotification({
        recipientAccountId: reserve.accountId,
        actorAccountId: game.ownerAccountId,
        gameId: game.id,
        kind: 'system',
        message: `你预约的「${game.title}」已发布，快来玩吧！`
      })

      reserve.notified = true
      await reserve.save()
      notifiedCount++
    }

    return notifiedCount
  } catch (err) {
    logger.error('Error notifying reservations', { err })
    return 0
  }
}
