import { logger } from '@server/helpers/logger.js'
import { GameNotificationModel } from '@server/models/game/game-notification.js'

/**
 * 发送站内通知（邮件通知依赖 SMTP 配置，由外部调度器处理）
 */
export async function sendNotificationWithFallback (options: {
  recipientAccountId: number
  actorAccountId: number | null
  gameId: number | null
  kind: string
  message: string
}): Promise<void> {
  try {
    // 创建站内通知
    await GameNotificationModel.create({
      recipientAccountId: options.recipientAccountId,
      actorAccountId: options.actorAccountId,
      gameId: options.gameId,
      kind: options.kind as any,
      message: options.message
    })
  } catch (err) {
    logger.error('Error sending notification', { err, options })
  }
}
