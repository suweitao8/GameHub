import { cleanUpReqFiles, createReqFiles } from '@server/helpers/express-utils.js'
import { generateGameCoverSignedUrl, generateGameRuntimeSignedUrl } from '@server/lib/games/game-cdn.js'
import { CONFIG } from '@server/initializers/config.js'
import { GameNotificationModel } from '@server/models/game/game-notification.js'
import type { MGame } from '@server/types/models/game/game.js'
import express from 'express'

export const gameFileUpload = createReqFiles([ 'gamefile', 'coverfile', 'screenshots' ], {
  'text/html': '.html',
  'application/xhtml+xml': '.html',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp'
})

export const MAX_GAMES_PER_ACCOUNT = 10

export const gameFile: express.RequestHandler = (req, res, next) => {
  gameFileUpload(req, res, err => {
    if (!err) return next()

    if (err.name === 'MulterError') {
      const field = 'field' in err && typeof err.field === 'string' ? err.field : undefined
      const error = field === 'cover'
        ? '封面文件字段名应为 coverfile，请重新提交。'
        : field
          ? `不支持上传字段：${field}`
          : '上传文件字段不符合要求，请检查提交的文件。'

      return res.status(400).json({ error })
    }

    return next(err)
  })
}

export function getUser (res: express.Response) {
  return res.locals.oauth?.token.User
}

export function formatGame (game: MGame) {
  const owner = (game as any).Owner
  const baseUrl = `${CONFIG.WEBSERVER.SCHEME}://${CONFIG.WEBSERVER.HOSTNAME}:${CONFIG.WEBSERVER.PORT}`
  return {
    uuid: game.uuid,
    title: game.title,
    description: game.description,
    instructions: game.instructions,
    category: game.category,
    tags: formatGameTags(game.tags),
    coverPath: game.status === 'published' && game.coverPath
      ? generateGameCoverSignedUrl({ uuid: game.uuid })
      : null,
    screenshots: game.status === 'published' && game.screenshotPaths?.length
      ? game.screenshotPaths.map((_: string, index: number) =>
          `${baseUrl}/api/v1/games/${game.uuid}/screenshots/${index}`
        )
      : [],
    status: game.status,
    featured: game.featured || false,
    featuredAt: game.featuredAt || null,
    fileSizeBytes: game.fileSizeBytes,
    playCount: game.playCount,
    comments: Number(game.get?.('gameReviews') ?? 0),
    likes: Number(game.get?.('gameLikes') ?? 0),
    favorites: Number(game.get?.('favoriteCount') || 0),
    coins: Number(game.get?.('coinCount') || 0),
    publishedAt: game.publishedAt,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    runtimeUrl: generateGameRuntimeSignedUrl({ uuid: game.uuid }),
    ownerAccountId: game.ownerAccountId,
    author: owner?.Actor ? {
      id: owner.id,
      name: owner.name,
      displayName: owner.getDisplayName(),
      handle: owner.Actor.getIdentifier()
    } : undefined
  }
}

export function formatGameTags (tags: unknown) {
  if (!Array.isArray(tags)) return []
  return tags.filter(tag => typeof tag === 'string' && tag.trim() !== '[' && tag.trim() !== ']')
}

export function formatGameNotification (notification: GameNotificationModel) {
  return {
    id: notification.id,
    kind: notification.kind,
    message: notification.message,
    read: !!notification.readAt,
    createdAt: notification.createdAt,
    actor: notification.Actor
      ? { id: notification.Actor.id, name: notification.Actor.name, displayName: notification.Actor.getDisplayName() }
      : null,
    game: notification.Game
      ? {
          uuid: notification.Game.uuid,
          title: notification.Game.title,
          coverPath: notification.Game.status === 'published' && notification.Game.coverPath
            ? generateGameCoverSignedUrl({ uuid: notification.Game.uuid })
            : null
        }
      : null
  }
}
