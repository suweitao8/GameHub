import { createHmac, timingSafeEqual } from 'crypto'
import { CONFIG } from '@server/initializers/config.js'

const SIGNATURE_ALGORITHM = 'sha256'
const DEFAULT_EXPIRES_SECONDS = 3600 * 24 // 24 hours
const CDN_CACHE_MAX_AGE_COVER = 86400 // 1 day
const CDN_CACHE_MAX_AGE_RUNTIME = 3600 // 1 hour

// ---------------------------------------------------------------------------
// Signed URL generation
// ---------------------------------------------------------------------------

export function generateGameSignedUrl (options: {
  uuid: string
  path: string
  expiresInSeconds?: number
}): string {
  const { uuid, path, expiresInSeconds = DEFAULT_EXPIRES_SECONDS } = options
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds
  const signature = _generateSignature({ uuid, path, expires })

  const baseUrl = `${CONFIG.WEBSERVER.SCHEME}://${CONFIG.WEBSERVER.HOSTNAME}:${CONFIG.WEBSERVER.PORT}`
  const url = new URL(`${baseUrl}${path}`)
  url.searchParams.set('sig', signature)
  url.searchParams.set('expires', expires.toString())

  return url.toString()
}

export function generateGameCoverSignedUrl (options: {
  uuid: string
}): string {
  return generateGameSignedUrl({
    uuid: options.uuid,
    path: `/api/v1/games/${options.uuid}/cover`,
    expiresInSeconds: DEFAULT_EXPIRES_SECONDS
  })
}

export function generateGameRuntimeSignedUrl (options: {
  uuid: string
  assetPath?: string
}): string {
  const { uuid, assetPath = '' } = options
  const path = assetPath
    ? `/api/v1/games/${uuid}/runtime/${assetPath}`
    : `/api/v1/games/${uuid}/runtime`

  return generateGameSignedUrl({ uuid, path, expiresInSeconds: DEFAULT_EXPIRES_SECONDS })
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

export function verifyGameSignedUrl (options: {
  uuid: string
  path: string
  signature: string
  expires: number
}): boolean {
  const { uuid, path, signature, expires } = options

  // Check expiration
  if (expires < Math.floor(Date.now() / 1000)) return false

  // Verify signature using constant-time comparison
  const expected = _generateSignature({ uuid, path, expires })
  if (expected.length !== signature.length) return false

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// CDN cache headers
// ---------------------------------------------------------------------------

export function getGameCoverCacheHeaders (): Record<string, string> {
  return {
    'Cache-Control': `public, max-age=${CDN_CACHE_MAX_AGE_COVER}, immutable`,
    'CDN-Cache-Control': `public, max-age=${CDN_CACHE_MAX_AGE_COVER}`,
    'Vary': 'Accept-Encoding',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  }
}

export function getGameRuntimeAssetCacheHeaders (): Record<string, string> {
  return {
    'Cache-Control': `public, max-age=${CDN_CACHE_MAX_AGE_RUNTIME}`,
    'CDN-Cache-Control': `public, max-age=${CDN_CACHE_MAX_AGE_RUNTIME}`,
    'Vary': 'Accept-Encoding',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  }
}

// ---------------------------------------------------------------------------
// ETag generation for conditional requests
// ---------------------------------------------------------------------------

export function generateGameAssetETag (sha256: string, assetPath?: string): string {
  const payload = assetPath ? `${sha256}:${assetPath}` : sha256
  return `"${createHmac(SIGNATURE_ALGORITHM, _getSecret()).update(payload).digest('hex').slice(0, 32)}"`
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function _generateSignature (options: { uuid: string; path: string; expires: number }): string {
  const { uuid, path, expires } = options
  const secret = _getSecret()
  const payload = `${uuid}:${path}:${expires}`

  return createHmac(SIGNATURE_ALGORITHM, secret)
    .update(payload)
    .digest('hex')
}

function _getSecret (): string {
  // Use the peertube secrets key as the signing secret
  const secret = CONFIG.SECRETS.PEERTUBE
  if (!secret || secret.length < 32) {
    throw new Error('游戏 CDN 签名需要有效的 secrets.peertube 配置')
  }

  return secret
}
