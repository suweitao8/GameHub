export const GAME_NOTIFICATION_KINDS = [ 'comment', 'reply', 'like', 'coin', 'favorite', 'follow', 'moderation', 'system' ] as const
export type GameNotificationKind = typeof GAME_NOTIFICATION_KINDS[number]

export function isGameNotificationKind (value: unknown): value is GameNotificationKind {
  return typeof value === 'string' && (GAME_NOTIFICATION_KINDS as readonly string[]).includes(value)
}

type CreateNotificationOptions = {
  recipientAccountId: number
  actorAccountId?: number | null
  gameId?: number | null
  kind: GameNotificationKind
  message: string
}

const notificationBatch: CreateNotificationOptions[] = []
const BATCH_SIZE = 50
const BATCH_INTERVAL_MS = 5000
const dedupSet = new Set<string>()

export async function createGameNotification (options: CreateNotificationOptions) {
  // Skip self-notifications
  if (options.actorAccountId && options.actorAccountId === options.recipientAccountId) return

  // Deduplicate by recipient + game + kind within the same batch window
  const dedupKey = `${options.recipientAccountId}:${options.gameId || 0}:${options.kind}:${options.actorAccountId || 0}`
  if (dedupSet.has(dedupKey)) return
  dedupSet.add(dedupKey)

  notificationBatch.push(options)
  if (notificationBatch.length >= BATCH_SIZE) {
    await flushNotificationBatch()
  } else if (notificationBatch.length === 1) {
    setTimeout(() => { void flushNotificationBatch() }, BATCH_INTERVAL_MS)
  }
}

async function flushNotificationBatch () {
  if (notificationBatch.length === 0) return

  const batch = notificationBatch.splice(0, notificationBatch.length)
  dedupSet.clear()

  const { GameNotificationModel } = await import('@server/models/game/game-notification.js')
  await GameNotificationModel.bulkCreate(
    batch.map(options => ({
      recipientAccountId: options.recipientAccountId,
      actorAccountId: options.actorAccountId || null,
      gameId: options.gameId || null,
      kind: options.kind,
      message: options.message,
      readAt: null
    })),
    { validate: true }
  )
}
