import { randomBytes } from 'crypto'
import { Redis } from '@server/lib/redis.js'
import { CONFIG } from '@server/initializers/config.js'

const SHARE_TOKEN_PREFIX = 'game-share:'
const SHARE_TOKEN_TTL_MS = 7 * 24 * 3600 * 1000 // 7 days in ms

export interface GameShareInfo {
  uuid: string
  token: string
  url: string
  shortUrl: string
}

/**
 * Generate a share token for a game and store it in Redis.
 * Returns both the full URL and a short URL with the token.
 */
export async function createGameShareToken (uuid: string): Promise<GameShareInfo> {
  const token = randomBytes(8).toString('base64url')
  const redisKey = `${SHARE_TOKEN_PREFIX}${token}`

  const baseUrl = `${CONFIG.WEBSERVER.SCHEME}://${CONFIG.WEBSERVER.HOSTNAME}:${CONFIG.WEBSERVER.PORT}`
  const url = `${baseUrl}/games/${uuid}`
  const shortUrl = `${baseUrl}/api/v1/games/s/${token}`

  const client = Redis.Instance.getClient()
  await client.set(
    Redis.Instance.getPrefix() + redisKey,
    JSON.stringify({ uuid, createdAt: Date.now() }),
    'PX',
    SHARE_TOKEN_TTL_MS
  )

  return { uuid, token, url, shortUrl }
}

/**
 * Resolve a share token to the game UUID.
 * Used by the short URL redirect route.
 */
export async function resolveGameShareToken (token: string): Promise<string | null> {
  if (!token || token.length > 16) return null

  // Validate token format (base64url characters only)
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null

  const redisKey = `${SHARE_TOKEN_PREFIX}${token}`
  const client = Redis.Instance.getClient()

  const value = await client.get(Redis.Instance.getPrefix() + redisKey)
  if (!value) return null

  try {
    const data = JSON.parse(value)
    return data.uuid || null
  } catch {
    return null
  }
}
