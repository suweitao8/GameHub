import { logger } from '@server/helpers/logger.js'

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

interface BatchEntry {
  options: CreateNotificationOptions
  retries: number
  createdAt: number
}

const BATCH_SIZE = 50
const BATCH_INTERVAL_MS = 5000
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000
const FLUSH_TIMEOUT_MS = 30000 // Force flush after 30s even if batch not full

const notificationBatch: BatchEntry[] = []
const dedupSet = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let forceFlushTimer: ReturnType<typeof setTimeout> | null = null
let isFlushing = false

export async function createGameNotification (options: CreateNotificationOptions) {
  // Skip self-notifications
  if (options.actorAccountId && options.actorAccountId === options.recipientAccountId) return

  // Deduplicate by recipient + game + kind within the same batch window
  const dedupKey = `${options.recipientAccountId}:${options.gameId || 0}:${options.kind}:${options.actorAccountId || 0}`
  if (dedupSet.has(dedupKey)) return
  dedupSet.add(dedupKey)

  const entry: BatchEntry = {
    options,
    retries: 0,
    createdAt: Date.now()
  }

  notificationBatch.push(entry)

  if (notificationBatch.length >= BATCH_SIZE) {
    await flushNotificationBatch()
  } else if (notificationBatch.length === 1) {
    scheduleFlush()
  }
}

async function flushNotificationBatch (): Promise<void> {
  if (isFlushing || notificationBatch.length === 0) return

  isFlushing = true
  clearTimers()

  const batch = notificationBatch.splice(0, notificationBatch.length)
  dedupSet.clear()

  try {
    const { GameNotificationModel } = await import('@server/models/game/game-notification.js')
    await GameNotificationModel.bulkCreate(
      batch.map(entry => ({
        recipientAccountId: entry.options.recipientAccountId,
        actorAccountId: entry.options.actorAccountId || null,
        gameId: entry.options.gameId || null,
        kind: entry.options.kind,
        message: entry.options.message,
        readAt: null
      })),
      { validate: true }
    )

    if (notificationBatch.length > 0) {
      scheduleFlush()
    }
  } catch (err) {
    logger.error('Failed to flush game notification batch, will retry failed entries', { err })

    // Re-queue failed entries with retry count
    const failed = batch.filter(entry => {
      if (entry.retries < MAX_RETRIES) {
        entry.retries++
        return true
      }
      return false
    })

    if (failed.length > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (failed[0].retries)))
      notificationBatch.unshift(...failed)
      dedupSet.clear()
      scheduleFlush()
    }
  } finally {
    isFlushing = false
  }
}

function scheduleFlush () {
  clearTimers()

  if (notificationBatch.length === 0) return

  flushTimer = setTimeout(() => {
    void flushNotificationBatch()
  }, BATCH_INTERVAL_MS)

  forceFlushTimer = setTimeout(() => {
    void flushNotificationBatch()
  }, FLUSH_TIMEOUT_MS)
}

function clearTimers () {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (forceFlushTimer) {
    clearTimeout(forceFlushTimer)
    forceFlushTimer = null
  }
}
