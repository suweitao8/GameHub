import { HttpStatusCode } from '@peertube/peertube-models'
import { GameAuditView, auditLoggerFactory, getAuditIdFromRes } from '@server/helpers/audit-logger.js'
import { cleanUpReqFiles } from '@server/helpers/express-utils.js'
import { sanitizeGameDescription } from '@server/helpers/game-sanitization.js'
import { logger } from '@server/helpers/logger.js'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { awardExp } from '@server/lib/games/game-exp.js'
import {
  cleanupStoredGameAssets,
  GameRuntimeValidationError,
  MAX_SCREENSHOTS,
  storeGameCover,
  storeGameRuntimePackage,
  storeGameScreenshot
} from '@server/lib/games/game-runtime.js'
import { createGameRuntimePreview } from '@server/lib/games/game-runtime-preview.js'
import { isGameModerator } from '@server/lib/games/game-policy.js'
import { CONFIG } from '@server/initializers/config.js'
import { GameModel } from '@server/models/game/game.js'
import { GameActivityModel } from '@server/models/game/game-activity.js'
import { asyncMiddleware, authenticate, gameUploadRateLimiter } from '@server/middlewares/index.js'
import { gameCreateValidator, parseGameTags } from '@server/middlewares/validators/games.js'
import { readFile } from 'fs/promises'
import express from 'express'
import { Op } from 'sequelize'
import { gameFile, MAX_GAMES_PER_ACCOUNT, getUser, formatGame, getGameRuntimeErrorMessage } from './game-shared.js'

const auditLogger = auditLoggerFactory('games')

const createRouter = express.Router()

createRouter.post('/preview', authenticate, gameUploadRateLimiter, gameFile, asyncMiddleware(previewGame))
createRouter.post('/', authenticate, gameUploadRateLimiter, gameFile, gameCreateValidator, asyncMiddleware(createGame))

export { createRouter }

function getPreviewRuntimeUrl (token: string) {
  return new URL(`/api/v1/games/preview/${token}/runtime/`, CONFIG.GAMES.RUNTIME_ORIGIN).toString()
}

async function previewGame (req: express.Request, res: express.Response) {
  const file = req.files?.['gamefile']?.[0]
  if (!file) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: '请上传单个 HTML 游戏文件。' })

  try {
    const content = await readFile(file.path)
    const preview = await createGameRuntimePreview({
      root: CONFIG.STORAGE.GAMES_DIR,
      filename: file.originalname,
      mimeType: file.mimetype,
      content,
      maxFileSizeBytes: CONFIG.GAMES.MAX_FILE_SIZE_BYTES
    })

    return res.status(HttpStatusCode.CREATED_201).json({
      token: preview.token,
      runtimeUrl: getPreviewRuntimeUrl(preview.token),
      fileSizeBytes: preview.stored.fileSizeBytes,
      fileCount: preview.stored.fileCount
    })
  } catch (err) {
    if (err instanceof GameRuntimeValidationError) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: getGameRuntimeErrorMessage(err) })
    throw err
  } finally {
    cleanUpReqFiles(req)
  }
}

async function createGame (req: express.Request, res: express.Response) {
  return traceGameOperation('createGame', async () => {
    const user = getUser(res)
    const file = req.files?.['gamefile']?.[0]
    if (!user || !file) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'gamefile is required' })

    const [ maintainedGames, recentUploads ] = await Promise.all([
      GameModel.count({ where: { ownerAccountId: user.Account.id, status: { [Op.ne]: 'unlisted' } } }),
      GameModel.count({ where: { ownerAccountId: user.Account.id, createdAt: { [Op.gte]: new Date(Date.now() - 60 * 60 * 1000) } } })
    ])
    if (maintainedGames >= MAX_GAMES_PER_ACCOUNT) {
      return res.status(HttpStatusCode.CONFLICT_409).json({ error: `Each account can maintain at most ${MAX_GAMES_PER_ACCOUNT} games` })
    }
    if (recentUploads >= CONFIG.GAMES.UPLOADS_PER_HOUR) return res.status(HttpStatusCode.TOO_MANY_REQUESTS_429).json({ error: 'Upload rate limit reached' })

    let stored: Awaited<ReturnType<typeof storeGameRuntimePackage>> | undefined
    let storedCover: Awaited<ReturnType<typeof storeGameCover>> | undefined
    const storedScreenshots: Awaited<ReturnType<typeof storeGameScreenshot>>[] = []
    let persisted = false
    try {
      const content = await readFile(file.path)
      stored = await storeGameRuntimePackage({
        root: CONFIG.STORAGE.GAMES_DIR,
        filename: file.originalname,
        mimeType: file.mimetype,
        content,
        maxFileSizeBytes: CONFIG.GAMES.MAX_FILE_SIZE_BYTES
      })

      const coverFile = req.files?.['coverfile']?.[0]
      if (coverFile) {
        storedCover = await storeGameCover({
          root: CONFIG.STORAGE.GAMES_DIR,
          filename: coverFile.originalname,
          mimeType: coverFile.mimetype,
          content: await readFile(coverFile.path)
        })
      }

      const screenshotFiles = req.files?.['screenshots']
      if (screenshotFiles && Array.isArray(screenshotFiles)) {
        const filesToProcess = screenshotFiles.slice(0, MAX_SCREENSHOTS)
        for (const screenshotFile of filesToProcess) {
          const storedScreenshot = await storeGameScreenshot({
            root: CONFIG.STORAGE.GAMES_DIR,
            filename: screenshotFile.originalname,
            mimeType: screenshotFile.mimetype,
            content: await readFile(screenshotFile.path)
          })
          storedScreenshots.push(storedScreenshot)
        }
      }

      const storageUsed = Number(await GameModel.sum('fileSizeBytes', {
        where: { ownerAccountId: user.Account.id, status: { [Op.ne]: 'unlisted' } }
      }) || 0)
      if (storageUsed + stored.fileSizeBytes > CONFIG.GAMES.MAX_STORAGE_PER_ACCOUNT_BYTES) {
        const cleanupSucceeded = await cleanupStoredGameAssets({ root: CONFIG.STORAGE.GAMES_DIR, runtime: stored, cover: storedCover, screenshots: storedScreenshots })
        if (!cleanupSucceeded) logger.warn('Failed to clean up game assets after a storage quota rejection.')
        return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Account game storage quota reached' })
      }

      const status = isGameModerator(user) || CONFIG.GAMES.REQUIRE_MODERATION !== true ? 'published' : 'pending'
      const game = await GameModel.create({
        ownerAccountId: user.Account.id,
        title: req.body.title,
        description: sanitizeGameDescription(req.body.description || ''),
        instructions: sanitizeGameDescription(req.body.instructions || ''),
        category: req.body.category,
        tags: parseGameTags(req.body.tags),
        runtimePath: stored.relativePath,
        runtimeSha256: stored.runtimeSha256,
        fileSizeBytes: stored.fileSizeBytes,
        coverPath: storedCover?.relativePath || null,
        screenshotPaths: storedScreenshots.map(s => s.relativePath),
        status,
        publishedAt: status === 'published' ? new Date() : null
      })
      persisted = true

      auditLogger.create(getAuditIdFromRes(res), new GameAuditView(formatGame(game)))
      awardExp(user.Account.id, 'PUBLISH_GAME').catch(() => undefined)

      if (game.status === 'published') {
        GameActivityModel.createActivity({
          actorAccountId: user.Account.id,
          gameId: game.id,
          kind: 'publish',
          message: `${user.username} 发布了游戏《${game.title}》`
        }).catch(() => undefined)
      }

      return res.status(HttpStatusCode.CREATED_201).json(formatGame(game))
    } catch (err) {
      if (!persisted) {
        const cleanupSucceeded = await cleanupStoredGameAssets({ root: CONFIG.STORAGE.GAMES_DIR, runtime: stored, cover: storedCover, screenshots: storedScreenshots })
        if (!cleanupSucceeded) logger.warn('Failed to clean up game assets after a game creation failure.', { err })
      }
      if (err instanceof GameRuntimeValidationError) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: getGameRuntimeErrorMessage(err) })
      throw err
    } finally {
      cleanUpReqFiles(req)
    }
  })
}
