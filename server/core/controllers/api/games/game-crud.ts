import { HttpStatusCode } from '@peertube/peertube-models'
import { GameAuditView, auditLoggerFactory, getAuditIdFromRes } from '@server/helpers/audit-logger.js'
import { cleanUpReqFiles } from '@server/helpers/express-utils.js'
import { sanitizeGameDescription } from '@server/helpers/game-sanitization.js'
import { generateGameCoverSignedUrl, generateGameRuntimeSignedUrl } from '@server/lib/games/game-cdn.js'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { invalidateRecommendationCache } from '@server/lib/games/game-recommendations.js'
import { awardExp } from '@server/lib/games/game-exp.js'
import { GameRuntimeValidationError, MAX_SCREENSHOTS, readStoredGameHtml, storeGameCover, storeGameRuntimePackage, storeGameScreenshot } from '@server/lib/games/game-runtime.js'
import { createGameRuntimePreview } from '@server/lib/games/game-runtime-preview.js'
import { canManageGame, isGameModerator } from '@server/lib/games/game-policy.js'
import { CONFIG } from '@server/initializers/config.js'
import { ROUTE_CACHE_LIFETIME } from '@server/initializers/constants.js'
import { GameModel } from '@server/models/game/game.js'
import { GameStatsSummaryModel } from '@server/models/game/game-stats-summary.js'
import { GameRecentModel } from '@server/models/game/game-recent.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { GameActivityModel } from '@server/models/game/game-activity.js'
import type { MGame } from '@server/types/models/game/game.js'
import { asyncMiddleware, authenticate, gamePlayRateLimiter, gameUploadRateLimiter, optionalAuthenticate, paginationValidator, setDefaultPagination } from '@server/middlewares/index.js'
import { gameCreateValidator, gameListValidator, gameUUIDValidator, parseGameTags } from '@server/middlewares/validators/games.js'
import { cacheRoute } from '@server/middlewares/cache/cache.js'
import { readFile, rm } from 'fs/promises'
import express from 'express'
import { Op } from 'sequelize'
import { gameFile, MAX_GAMES_PER_ACCOUNT, getUser, formatGame } from './game-shared.js'

const auditLogger = auditLoggerFactory('games')

const crudRouter = express.Router()

crudRouter.get('/', paginationValidator, setDefaultPagination, gameListValidator, optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_LIST), asyncMiddleware(listGames))
crudRouter.get('/admin', authenticate, asyncMiddleware(listGamesForModerators))
crudRouter.post('/preview', authenticate, gameUploadRateLimiter, gameFile, asyncMiddleware(previewGame))
crudRouter.get('/:uuid/download', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(downloadGame))
crudRouter.get('/:uuid', gameUUIDValidator, optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_DETAIL), asyncMiddleware(getGame))
crudRouter.get('/:uuid/seo', gameUUIDValidator, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_DETAIL), asyncMiddleware(getGameSEO))
crudRouter.post('/', authenticate, gameUploadRateLimiter, gameFile, gameCreateValidator, asyncMiddleware(createGame))
crudRouter.put('/:uuid', authenticate, gameUUIDValidator, gameUploadRateLimiter, gameFile, gameCreateValidator, asyncMiddleware(updateGame))
crudRouter.delete('/:uuid', authenticate, gameUUIDValidator, asyncMiddleware(removeGame))
crudRouter.post('/:uuid/play', gameUUIDValidator, gamePlayRateLimiter, optionalAuthenticate, asyncMiddleware(recordPlay))

export { crudRouter }

function getPreviewRuntimeUrl (token: string) {
  return new URL(`/api/v1/games/preview/${token}/runtime/`, CONFIG.GAMES.RUNTIME_ORIGIN).toString()
}

function getGameRuntimeErrorMessage (error: GameRuntimeValidationError) {
  const messages: Record<string, string> = {
    'Only a single HTML file is supported': '请上传单个 .html 或 .htm 文件，大小不能超过 20MB。',
    'Game file cannot be empty': '游戏文件不能为空。',
    'Game file is too large': 'HTML 文件不能超过 20MB。',
    'External resources are not supported': '游戏只能使用包内资源，不能引用外部网络资源。',
    'Game resource path is missing or unsafe': '游戏引用了不存在或不安全的资源路径。',
    'Network and top-level navigation APIs are not supported': '游戏不能联网或跳转到顶层页面。',
    'Navigation and forms are not supported': '游戏不能包含页面跳转或表单提交。',
    'Game file contains an invalid character': '游戏文件包含无效字符。',
  }

  return messages[error.message] || '游戏文件未通过安全检查，请检查文件格式和资源引用。'
}

async function listGames (req: express.Request, res: express.Response) {
  return traceGameOperation('listGames', async () => {
    const start = Math.max(0, Number(req.query.start) || 0)
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 15))
    const following = req.query.view === 'following'
    const user = getUser(res)
    const ownerAccountIds = following
      ? await getFollowedAccountIds(user?.Account?.Actor?.id)
      : undefined

    if (following && !user) return res.json({ total: 0, data: [] })

    const result = await GameModel.listPublished({
      category: req.query.category as string,
      search: req.query.search as string,
      publishedAfter: req.query.publishedAfter as string,
      device: req.query.device as string,
      ownerAccountIds,
      sort: req.query.sort as string,
      limit: count,
      offset: start
    })

    return res.json({ total: result.total, data: result.data.map(formatGame) })
  })
}

async function getFollowedAccountIds (actorId: number | undefined) {
  if (!actorId) return []

  const follows = await ActorFollowModel.findAll({
    where: { actorId, state: 'accepted' },
    attributes: [ 'targetActorId' ],
    raw: true
  })
  const targetActorIds = follows.map(follow => follow.targetActorId)
  if (targetActorIds.length === 0) return []

  const accounts = await ActorModel.findAll({
    where: { id: targetActorIds },
    attributes: [ 'accountId' ],
    raw: true
  })
  return [ ...new Set(accounts.map(account => account.accountId)) ]
}

async function listGamesForModerators (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  if (!user || !isGameModerator(user)) return res.sendStatus(HttpStatusCode.FORBIDDEN_403)

  const data = await GameModel.findAll<MGame>({
    include: [ { model: AccountModel, required: true } ],
    order: [ [ 'createdAt', 'DESC' ] ],
    limit: 100
  })
  return res.json({ total: data.length, data: data.map(formatGame) })
}

async function getGame (req: express.Request, res: express.Response) {
  return traceGameOperation('getGame', async () => {
    const game = await GameModel.loadByUUID(req.params.uuid)
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const user = getUser(res)
    const visible = game.status === 'published' || (user && (canManageGame(game, user) || isGameModerator(user)))
    if (!visible) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    return res.json(formatGame(game))
  })
}

async function downloadGame (req: express.Request, res: express.Response) {
  const game = await GameModel.loadByUUID(req.params.uuid)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const user = getUser(res)
  const visible = game.status === 'published' || (user && (canManageGame(game, user) || isGameModerator(user)))
  if (!visible) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const content = await readStoredGameHtml(CONFIG.STORAGE.GAMES_DIR, game.runtimePath)
  res.status(HttpStatusCode.OK_200)
    .setHeader('Content-Type', 'text/html; charset=utf-8')
    .setHeader('Content-Disposition', `attachment; filename="gamehub-${game.uuid}.html"`)
    .setHeader('Cache-Control', 'private, no-store')
    .send(content)
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
        await rm(stored.absoluteDirectory, { recursive: true, force: true })
        if (storedCover) await rm(storedCover.absolutePath, { force: true })
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
      if (stored) await rm(stored.absoluteDirectory, { recursive: true, force: true }).catch(() => undefined)
      if (storedCover) await rm(storedCover.absolutePath, { force: true }).catch(() => undefined)
      if (err instanceof GameRuntimeValidationError) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: getGameRuntimeErrorMessage(err) })
      throw err
    } finally {
      cleanUpReqFiles(req)
    }
  })
}

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

async function recordPlay (req: express.Request, res: express.Response) {
  return traceGameOperation('recordPlay', async () => {
    const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    await GameModel.increment('playCount', { by: 1, where: { id: game.id } })

    const user = getUser(res)
    if (user) {
      await GameRecentModel.upsert({
        gameId: game.id,
        accountId: user.Account.id,
        lastPlayedAt: new Date()
      })
      awardExp(user.Account.id, 'PLAY_GAME').catch(() => undefined)
      invalidateRecommendationCache(user.Account.id).catch(() => undefined)
    }

    return res.json({ runtimeUrl: generateGameRuntimeSignedUrl({ uuid: game.uuid }) })
  })
}

/**
 * 游戏详情页 SEO 元数据 — Open Graph + Twitter Card
 * 供前端 SSR 或 meta 标签注入使用
 */
async function getGameSEO (req: express.Request, res: express.Response) {
  const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const baseUrl = `${CONFIG.WEBSERVER.SCHEME}://${CONFIG.WEBSERVER.HOSTNAME}:${CONFIG.WEBSERVER.PORT}`
  const gameUrl = `${baseUrl}/games/${game.uuid}`
  const coverUrl = game.coverPath
    ? generateGameCoverSignedUrl({ uuid: game.uuid })
    : null

  // Truncate description for social previews (max 200 chars)
  const shortDescription = game.description.length > 200
    ? game.description.slice(0, 197) + '...'
    : game.description

  const owner = (game as any).Owner
  const authorName = owner?.getDisplayName?.() || owner?.name || ''

  const stats = await GameStatsSummaryModel.findOne({ where: { gameId: game.id }, raw: true })

  return res.json({
    url: gameUrl,
    type: 'website',
    title: `${game.title} - GameHub`,
    description: shortDescription,
    siteName: 'GameHub',
    locale: 'zh_CN',
    image: coverUrl,
    imageWidth: 630,
    imageHeight: 1200,
    twitterCard: 'summary_large_image',
    twitterTitle: game.title,
    twitterDescription: shortDescription,
    twitterImage: coverUrl,
    author: authorName,
    category: game.category,
    tags: game.tags,
    stats: stats ? {
      plays: stats.plays,
      likes: stats.likes,
      averageReviewScore: Number(stats.averageReviewScore)
    } : null,
    publishedTime: game.publishedAt?.toISOString() || null,
    modifiedTime: game.updatedAt?.toISOString()
  })
}
