import { HttpStatusCode } from '@peertube/peertube-models'
import { GameAuditView, auditLoggerFactory, getAuditIdFromRes } from '@server/helpers/audit-logger.js'
import { cleanUpReqFiles } from '@server/helpers/express-utils.js'
import { sanitizeGameDescription } from '@server/helpers/game-sanitization.js'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { GameRuntimeValidationError, MAX_SCREENSHOTS, storeGameCover, storeGameRuntimePackage, storeGameScreenshot } from '@server/lib/games/game-runtime.js'
import { canManageGame, isGameModerator } from '@server/lib/games/game-policy.js'
import { CONFIG } from '@server/initializers/config.js'
import { GameModel } from '@server/models/game/game.js'
import { asyncMiddleware, authenticate, gameUploadRateLimiter } from '@server/middlewares/index.js'
import { gameCreateValidator, gameUUIDValidator, parseGameTags } from '@server/middlewares/validators/games.js'
import { readFile, rm } from 'fs/promises'
import express from 'express'
import { gameFile, getUser, formatGame, getGameRuntimeErrorMessage } from './game-shared.js'

const auditLogger = auditLoggerFactory('games')

const updateRouter = express.Router()

updateRouter.put('/:uuid', authenticate, gameUUIDValidator, gameUploadRateLimiter, gameFile, gameCreateValidator, asyncMiddleware(updateGame))
updateRouter.delete('/:uuid', authenticate, gameUUIDValidator, asyncMiddleware(removeGame))

export { updateRouter }

async function updateGame (req: express.Request, res: express.Response) {
  return traceGameOperation('updateGame', async () => {
    const user = getUser(res)
    const game = await GameModel.loadByUUID(req.params.uuid)
    if (!game || !user || !canManageGame(game, user)) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
    if (game.status === 'blocked' && !isGameModerator(user)) return res.sendStatus(HttpStatusCode.FORBIDDEN_403)

    const oldGame = formatGame(game)
    const file = req.files?.['gamefile']?.[0]
    let stored: Awaited<ReturnType<typeof storeGameRuntimePackage>> | undefined
    let storedCover: Awaited<ReturnType<typeof storeGameCover>> | undefined
    const storedScreenshots: Awaited<ReturnType<typeof storeGameScreenshot>>[] = []
    try {
      if (file) {
        const content = await readFile(file.path)
        stored = await storeGameRuntimePackage({
          root: CONFIG.STORAGE.GAMES_DIR,
          filename: file.originalname,
          mimeType: file.mimetype,
          content,
          maxFileSizeBytes: CONFIG.GAMES.MAX_FILE_SIZE_BYTES
        })
        game.runtimePath = stored.relativePath
        game.runtimeSha256 = stored.runtimeSha256
        game.fileSizeBytes = stored.fileSizeBytes
      }

      const coverFile = req.files?.['coverfile']?.[0]
      if (coverFile) {
        storedCover = await storeGameCover({
          root: CONFIG.STORAGE.GAMES_DIR,
          filename: coverFile.originalname,
          mimeType: coverFile.mimetype,
          content: await readFile(coverFile.path)
        })
        game.coverPath = storedCover.relativePath
      }

      const screenshotFiles = req.files?.['screenshots']
      if (screenshotFiles && Array.isArray(screenshotFiles)) {
        const currentCount = game.screenshotPaths?.length || 0
        const availableSlots = MAX_SCREENSHOTS - currentCount
        const filesToProcess = screenshotFiles.slice(0, Math.max(0, availableSlots))
        for (const screenshotFile of filesToProcess) {
          const storedScreenshot = await storeGameScreenshot({
            root: CONFIG.STORAGE.GAMES_DIR,
            filename: screenshotFile.originalname,
            mimeType: screenshotFile.mimetype,
            content: await readFile(screenshotFile.path)
          })
          storedScreenshots.push(storedScreenshot)
        }
        game.screenshotPaths = [ ...(game.screenshotPaths || []), ...storedScreenshots.map(s => s.relativePath) ]
      }

      game.title = req.body.title
      game.description = sanitizeGameDescription(req.body.description || '')
      game.instructions = sanitizeGameDescription(req.body.instructions || '')
      game.category = req.body.category
      game.tags = parseGameTags(req.body.tags)

      if (!isGameModerator(user)) {
        game.status = 'pending'
        game.publishedAt = null
      }

      await game.save()
      auditLogger.update(getAuditIdFromRes(res), new GameAuditView(formatGame(game)), new GameAuditView(oldGame))
      return res.json(formatGame(game))
    } catch (err) {
      if (stored) await rm(stored.absoluteDirectory, { recursive: true, force: true }).catch(() => undefined)
      if (storedCover) await rm(storedCover.absolutePath, { force: true }).catch(() => undefined)
      if (err instanceof GameRuntimeValidationError) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: getGameRuntimeErrorMessage(err) })
      throw err
    } finally {
      cleanUpReqFiles(req)
    }
  })
}

async function removeGame (req: express.Request, res: express.Response) {
  return traceGameOperation('removeGame', async () => {
    const user = getUser(res)
    const game = await GameModel.loadByUUID(req.params.uuid)
    if (!game || !user || !canManageGame(game, user)) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    game.status = 'unlisted'
    game.publishedAt = null
    await game.save()

    auditLogger.delete(getAuditIdFromRes(res), new GameAuditView(formatGame(game)))

    return res.status(HttpStatusCode.NO_CONTENT_204).end()
  })
}
