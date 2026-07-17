export const GAME_NOTIFICATION_KINDS = [ 'comment', 'reply', 'like', 'coin', 'favorite', 'follow', 'moderation', 'system' ] as const
export type GameNotificationKind = typeof GAME_NOTIFICATION_KINDS[number]

export function isGameNotificationKind (value: unknown): value is GameNotificationKind {
  return typeof value === 'string' && (GAME_NOTIFICATION_KINDS as readonly string[]).includes(value)
}

export async function createGameNotification (options: {
  recipientAccountId: number
  actorAccountId?: number | null
  gameId?: number | null
  kind: GameNotificationKind
  message: string
}) {
  const { GameNotificationModel } = await import('@server/models/game/game-notification.js')
  return GameNotificationModel.create({
    recipientAccountId: options.recipientAccountId,
    actorAccountId: options.actorAccountId || null,
    gameId: options.gameId || null,
    kind: options.kind,
    message: options.message,
    readAt: null
  })
}
