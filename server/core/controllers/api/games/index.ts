import { HttpStatusCode } from '@peertube/peertube-models'
import { GameAuditView, auditLoggerFactory, getAuditIdFromRes } from '@server/helpers/audit-logger.js'
import { cleanUpReqFiles, createReqFiles } from '@server/helpers/express-utils.js'
import { GameRuntimeValidationError, storeGameCover, storeGameRuntimePackage } from '@server/lib/games/game-runtime.js'
import { createGameRuntimePreview } from '@server/lib/games/game-runtime-preview.js'
import { createGameNotification } from '@server/lib/games/game-notifications.js'
import { canManageGame, getModerationStatus, isGameModerator } from '@server/lib/games/game-policy.js'
import { CONFIG } from '@server/initializers/config.js'
import { GameModel } from '@server/models/game/game.js'
import { GameFavoriteModel } from '@server/models/game/game-favorite.js'
import { GameRecentModel } from '@server/models/game/game-recent.js'
import { GameCoinLedgerModel } from '@server/models/game/game-coin-ledger.js'
import { GameNotificationModel } from '@server/models/game/game-notification.js'
import { AccountModel } from '@server/models/account/account.js'
import { ActorFollowModel } from '@server/models/actor/actor-follow.js'
import { ActorModel } from '@server/models/actor/actor.js'
import type { MGame } from '@server/types/models/game/game.js'
import { apiRateLimiter, asyncMiddleware, authenticate, optionalAuthenticate, paginationValidator, setDefaultPagination } from '@server/middlewares/index.js'
import { gameCreateValidator, gameListValidator, gameModerationValidator, gameUUIDValidator, parseGameTags } from '@server/middlewares/validators/games.js'
import { readFile, rm } from 'fs/promises'
import express from 'express'
import { Op } from 'sequelize'
import { dirname, relative, resolve, sep } from 'path'
import { runtimeRouter } from './runtime.js'
import { gameCommunityRouter } from './community.js'

const gameFileUpload = createReqFiles([ 'gamefile', 'coverfile' ], {
  'text/html': '.html',
  'application/xhtml+xml': '.html',
  'application/zip': '.zip',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp'
})

const gameFile: express.RequestHandler = (req, res, next) => {
  gameFileUpload(req, res, err => {
    if (!err) return next()

    if (err.name === 'MulterError') {
      const field = 'field' in err && typeof err.field === 'string' ? err.field : undefined
      const error = field === 'cover'
        ? '封面文件字段名应为 coverfile，请重新提交。'
        : field
          ? `不支持上传字段：${field}`
          : '上传文件字段不符合要求，请检查提交的文件。'

      return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error })
    }

    return next(err)
  })
}

const gamesRouter = express.Router()
const auditLogger = auditLoggerFactory('games')
gamesRouter.use(apiRateLimiter)
gamesRouter.use('/', runtimeRouter)
gamesRouter.use('/', gameCommunityRouter)

gamesRouter.get('/', paginationValidator, setDefaultPagination, gameListValidator, optionalAuthenticate, asyncMiddleware(listGames))
gamesRouter.get('/admin', authenticate, asyncMiddleware(listGamesForModerators))
gamesRouter.get('/me/favorites', authenticate, asyncMiddleware(listFavoriteGames))
gamesRouter.get('/me/recent', authenticate, asyncMiddleware(listRecentGames))
gamesRouter.get('/me/owned', authenticate, asyncMiddleware(listOwnedGames))
gamesRouter.get('/me/overview', authenticate, asyncMiddleware(getCreatorOverview))
gamesRouter.get('/me/notifications', authenticate, asyncMiddleware(listGameNotifications))
gamesRouter.put('/me/notifications/:notificationId/read', authenticate, asyncMiddleware(markGameNotificationRead))
gamesRouter.post('/me/notifications/read-all', authenticate, asyncMiddleware(markAllGameNotificationsRead))
gamesRouter.get('/author/:accountId', optionalAuthenticate, asyncMiddleware(getAuthor))
gamesRouter.post('/preview', authenticate, gameFile, asyncMiddleware(previewGame))
gamesRouter.get('/:uuid/download', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(downloadGame))
gamesRouter.get('/:uuid', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(getGame))
gamesRouter.post('/', authenticate, gameFile, gameCreateValidator, asyncMiddleware(createGame))
gamesRouter.put('/:uuid', authenticate, gameUUIDValidator, gameFile, gameCreateValidator, asyncMiddleware(updateGame))
gamesRouter.delete('/:uuid', authenticate, gameUUIDValidator, asyncMiddleware(removeGame))
gamesRouter.post('/:uuid/play', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(recordPlay))
gamesRouter.post('/:uuid/moderate', authenticate, gameModerationValidator, asyncMiddleware(moderateGame))

export {
  gamesRouter
}

function getUser (res: express.Response) {
  return res.locals.oauth?.token.User
}

function formatGame (game: MGame) {
  const owner = (game as any).Owner
  return {
    uuid: game.uuid,
    title: game.title,
    description: game.description,
    instructions: game.instructions,
    category: game.category,
    tags: formatGameTags(game.tags),
    coverPath: game.coverPath ? new URL(`/api/v1/games/${game.uuid}/cover`, CONFIG.GAMES.RUNTIME_ORIGIN).toString() : null,
    status: game.status,
    fileSizeBytes: game.fileSizeBytes,
    playCount: game.playCount,
    comments: Number(game.get?.('gameComments') ?? 0),
    likes: Number(game.get?.('gameLikes') ?? 0),
    favorites: Number(game.get?.('favoriteCount') || 0),
    coins: Number(game.get?.('coinCount') || 0),
    publishedAt: game.publishedAt,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    runtimeUrl: getRuntimeUrl(game.uuid),
    ownerAccountId: game.ownerAccountId,
    author: owner?.Actor ? {
      id: owner.id,
      name: owner.name,
      displayName: owner.getDisplayName(),
      handle: owner.Actor.getIdentifier()
    } : undefined
  }
}

function formatGameTags (tags: unknown) {
  if (!Array.isArray(tags)) return []
  return tags.filter(tag => typeof tag === 'string' && tag.trim() !== '[' && tag.trim() !== ']')
}

function formatGameNotification (notification: GameNotificationModel) {
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
      ? { uuid: notification.Game.uuid, title: notification.Game.title }
      : null
  }
}

async function listGameNotifications (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  const where = { recipientAccountId: user.Account.id }
  const [ total, unread, data ] = await Promise.all([
    GameNotificationModel.count({ where }),
    GameNotificationModel.count({ where: { ...where, readAt: null } }),
    GameNotificationModel.findAll({
      where,
      include: [
        { model: AccountModel, as: 'Actor', required: false },
        { model: GameModel, required: false }
      ],
      order: [ [ 'createdAt', 'DESC' ] ],
      limit: 100
    })
  ])

  return res.json({ total, unread, data: data.map(formatGameNotification) })
}

async function markGameNotificationRead (req: express.Request, res: express.Response) {
  const user = getUser(res)
  const notification = await GameNotificationModel.findOne({
    where: { id: Number(req.params.notificationId), recipientAccountId: user.Account.id }
  })
  if (!notification) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  notification.readAt = notification.readAt || new Date()
  await notification.save()
  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function markAllGameNotificationsRead (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  await GameNotificationModel.update(
    { readAt: new Date() },
    { where: { recipientAccountId: user.Account.id, readAt: null } }
  )
  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function getAuthor (req: express.Request, res: express.Response) {
  const accountId = Number(req.params.accountId)
  if (!Number.isInteger(accountId) || accountId < 1) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  const account = await AccountModel.load(accountId)
  if (!account?.Actor) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  const games = await GameModel.findAll<MGame>({
    where: { ownerAccountId: accountId, status: 'published' },
    attributes: { include: GameModel.getPublicStatsAttributes() },
    include: [ { model: AccountModel, required: true } ],
    order: [ [ 'publishedAt', 'DESC' ] ],
    limit: 100
  })
  const [ favorites, coins ] = await Promise.all([
    GameFavoriteModel.count({ where: { gameId: games.map(game => game.id) } }),
    GameCoinLedgerModel.sum('amount', { where: { gameId: games.map(game => game.id), kind: 'spend' } })
  ])
  const user = getUser(res)
  const following = user?.Account?.Actor
    ? !!await ActorFollowModel.loadByActorAndTarget(user.Account.Actor.id, account.Actor.id)
    : false
  return res.json({
    account: {
      id: account.id,
      name: account.name,
      displayName: account.getDisplayName(),
      description: account.description || '',
      handle: account.Actor.getIdentifier(),
      followers: account.Actor.followersCount || 0
    },
    stats: {
      games: games.length,
      plays: games.reduce((sum, game) => sum + game.playCount, 0),
      likes: games.reduce((sum, game) => sum + Number(game.get?.('gameLikes') || 0), 0),
      favorites,
      coins: Math.max(0, Number(coins || 0) * -1)
    },
    following,
    data: games.map(formatGame)
  })
}

async function getCreatorOverview (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  const games = await GameModel.findAll<MGame>({
    where: { ownerAccountId: user.Account.id },
    attributes: { include: GameModel.getPublicStatsAttributes() },
    include: [],
    order: [ [ 'createdAt', 'DESC' ] ]
  })
  const gameIds = games.map(game => game.id)
  const [ favorites, coins ] = await Promise.all([
    GameFavoriteModel.count({ where: { gameId: gameIds } }),
    GameCoinLedgerModel.sum('amount', { where: { gameId: gameIds, kind: 'spend' } })
  ])
  const day = new Date().toISOString().slice(0, 10)
  await GameCoinLedgerModel.findOrCreate({
    where: { accountId: user.Account.id, day, kind: 'daily_grant' },
    defaults: { accountId: user.Account.id, gameId: null, day, kind: 'daily_grant', amount: 2 }
  })
  const coinBalance = Number(await GameCoinLedgerModel.sum('amount', { where: { accountId: user.Account.id } }) || 0)
  return res.json({
    gameCount: games.length,
    gameLimit: 5,
    storageBytes: games.reduce((sum, game) => sum + game.fileSizeBytes, 0),
    storageLimitBytes: CONFIG.GAMES.MAX_STORAGE_PER_ACCOUNT_BYTES,
    plays: games.reduce((sum, game) => sum + game.playCount, 0),
    likes: games.reduce((sum, game) => sum + Number(game.get?.('gameLikes') || 0), 0),
    coins: Math.max(0, Number(coins || 0) * -1),
    coinBalance: Math.max(0, coinBalance),
    favorites,
    followers: Number((user.Account.Actor as any)?.followersCount || 0),
    games: games.map(formatGame)
  })
}

function getRuntimeUrl (uuid: string) {
  return new URL(`/api/v1/games/${uuid}/runtime/`, CONFIG.GAMES.RUNTIME_ORIGIN).toString()
}

function getPreviewRuntimeUrl (token: string) {
  return new URL(`/api/v1/games/preview/${token}/runtime/`, CONFIG.GAMES.RUNTIME_ORIGIN).toString()
}

function getGameRuntimeErrorMessage (error: GameRuntimeValidationError) {
  const messages: Record<string, string> = {
    'Only a single HTML file is supported': '请上传 .html、.htm 或 .zip 游戏文件。',
    'Game file cannot be empty': '游戏文件不能为空。',
    'Game file is too large': 'HTML 文件不能超过 20MB。',
    'Game package cannot be empty': '游戏压缩包不能为空。',
    'Game package archive is too large': '游戏压缩包不能超过 20MB。',
    'Game package must contain a root index.html': '压缩包根目录必须包含 index.html。',
    'Game package contains an unsafe path': '压缩包包含不安全的文件路径。',
    'Game package contains too many files': '压缩包内文件数量超过限制。',
    'Game package contains an unsupported file type': '压缩包包含不支持或危险的文件类型。',
    'Game package contains duplicate paths': '压缩包包含重复的文件路径。',
    'Game package is too large after extraction': '游戏解压后的资源总大小超过 20MB。',
    'External resources are not supported': '游戏只能使用包内资源，不能引用外部网络资源。',
    'Game resource path is missing or unsafe': '游戏引用了不存在或不安全的资源路径。',
    'Network and top-level navigation APIs are not supported': '游戏不能联网或跳转到顶层页面。',
    'Navigation and forms are not supported': '游戏不能包含页面跳转或表单提交。',
    'Game file contains an invalid character': '游戏文件包含无效字符。',
    'Invalid game package archive': '游戏压缩包损坏或格式无效。'
  }

  return messages[error.message] || '游戏文件未通过安全检查，请检查文件格式和资源引用。'
}

async function listGames (req: express.Request, res: express.Response) {
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

  const data = await GameModel.findAll<MGame>({ order: [ [ 'createdAt', 'DESC' ] ], limit: 100 })
  return res.json({ total: data.length, data: data.map(formatGame) })
}

async function listFavoriteGames (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

  const rows = await GameFavoriteModel.findAll<any>({
    where: { accountId: user.Account.id },
    include: [ {
      model: GameModel,
      where: { status: 'published' },
      required: true,
      attributes: { include: GameModel.getPublicStatsAttributes('"Game"') },
      include: []
    } ],
    order: [ [ 'createdAt', 'DESC' ] ],
    limit: 100
  })

  return res.json({ total: rows.length, data: rows.map(row => formatGame(row.Game)) })
}

async function listRecentGames (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

  const rows = await GameRecentModel.findAll<any>({
    where: { accountId: user.Account.id },
    include: [ {
      model: GameModel,
      where: { status: 'published' },
      required: true,
      attributes: { include: GameModel.getPublicStatsAttributes('"Game"') },
      include: []
    } ],
    order: [ [ 'lastPlayedAt', 'DESC' ] ],
    limit: 100
  })

  return res.json({ total: rows.length, data: rows.map(row => formatGame(row.Game)) })
}

async function listOwnedGames (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

  const data = await GameModel.findAll<MGame>({
    where: { ownerAccountId: user.Account.id },
    attributes: { include: GameModel.getPublicStatsAttributes() },
    include: [],
    order: [ [ 'createdAt', 'DESC' ] ],
    limit: 100
  })

  return res.json({ total: data.length, data: data.map(formatGame) })
}

async function getGame (req: express.Request, res: express.Response) {
  const game = await GameModel.loadByUUID(req.params.uuid)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const user = getUser(res)
  const visible = game.status === 'published' || (user && (canManageGame(game, user) || isGameModerator(user)))
  if (!visible) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  return res.json(formatGame(game))
}

async function downloadGame (req: express.Request, res: express.Response) {
  const game = await GameModel.loadByUUID(req.params.uuid)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const user = getUser(res)
  const visible = game.status === 'published' || (user && (canManageGame(game, user) || isGameModerator(user)))
  if (!visible) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const rootPath = resolve(CONFIG.STORAGE.GAMES_DIR)
  const runtimeDirectory = resolve(rootPath, dirname(game.runtimePath))
  const directoryRelativePath = relative(rootPath, runtimeDirectory)
  if (!directoryRelativePath || directoryRelativePath.startsWith(`..${sep}`) || directoryRelativePath === '..') {
    return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  }

  const archiverModule = await import('archiver')
  const archive = new archiverModule.ZipArchive({ zlib: { level: 9 } })
  const filename = `gamehub-${game.uuid}.zip`

  res.statusCode = HttpStatusCode.OK_200
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Cache-Control', 'private, no-store')
  archive.on('error', error => {
    if (!res.headersSent) res.status(HttpStatusCode.INTERNAL_SERVER_ERROR_500)
    res.destroy(error)
  })
  archive.pipe(res)
  archive.directory(runtimeDirectory, false)
  await archive.finalize()
}

async function previewGame (req: express.Request, res: express.Response) {
  const file = req.files?.['gamefile']?.[0]
  if (!file) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: '请上传 HTML 或 ZIP 游戏文件。' })

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
  const user = getUser(res)
  const file = req.files?.['gamefile']?.[0]
  if (!user || !file) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: 'gamefile is required' })

  const [ maintainedGames, recentUploads ] = await Promise.all([
    GameModel.count({ where: { ownerAccountId: user.Account.id, status: { [Op.ne]: 'unlisted' } } }),
    GameModel.count({ where: { ownerAccountId: user.Account.id, createdAt: { [Op.gte]: new Date(Date.now() - 60 * 60 * 1000) } } })
  ])
  if (maintainedGames >= 5) return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Each account can maintain at most 5 games' })
  if (recentUploads >= CONFIG.GAMES.UPLOADS_PER_HOUR) return res.status(HttpStatusCode.TOO_MANY_REQUESTS_429).json({ error: 'Upload rate limit reached' })

  let stored: Awaited<ReturnType<typeof storeGameRuntimePackage>> | undefined
  let storedCover: Awaited<ReturnType<typeof storeGameCover>> | undefined
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
      description: req.body.description || '',
      instructions: req.body.instructions || '',
      category: req.body.category,
      tags: parseGameTags(req.body.tags),
      runtimePath: stored.relativePath,
      runtimeSha256: stored.runtimeSha256,
      fileSizeBytes: stored.fileSizeBytes,
      coverPath: storedCover?.relativePath || null,
      status,
      publishedAt: status === 'published' ? new Date() : null
    })

    auditLogger.create(getAuditIdFromRes(res), new GameAuditView(formatGame(game)))

    return res.status(HttpStatusCode.CREATED_201).json(formatGame(game))
  } catch (err) {
    if (stored) await rm(stored.absoluteDirectory, { recursive: true, force: true }).catch(() => undefined)
    if (storedCover) await rm(storedCover.absolutePath, { force: true }).catch(() => undefined)
    if (err instanceof GameRuntimeValidationError) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: getGameRuntimeErrorMessage(err) })
    throw err
  } finally {
    cleanUpReqFiles(req)
  }
}

async function updateGame (req: express.Request, res: express.Response) {
  const user = getUser(res)
  const game = await GameModel.loadByUUID(req.params.uuid)
  if (!game || !user || !canManageGame(game, user)) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (game.status === 'blocked' && !isGameModerator(user)) return res.sendStatus(HttpStatusCode.FORBIDDEN_403)

  const oldGame = formatGame(game)
  const file = req.files?.['gamefile']?.[0]
  let stored: Awaited<ReturnType<typeof storeGameRuntimePackage>> | undefined
  let storedCover: Awaited<ReturnType<typeof storeGameCover>> | undefined
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

    game.title = req.body.title
    game.description = req.body.description || ''
    game.instructions = req.body.instructions || ''
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
}

async function removeGame (req: express.Request, res: express.Response) {
  const user = getUser(res)
  const game = await GameModel.loadByUUID(req.params.uuid)
  if (!game || !user || !canManageGame(game, user)) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  game.status = 'unlisted'
  game.publishedAt = null
  await game.save()

  auditLogger.delete(getAuditIdFromRes(res), new GameAuditView(formatGame(game)))

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function recordPlay (req: express.Request, res: express.Response) {
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
  }

  return res.json({ runtimeUrl: getRuntimeUrl(game.uuid) })
}

async function moderateGame (req: express.Request, res: express.Response) {
  const user = getUser(res)
  if (!user || !isGameModerator(user)) return res.sendStatus(HttpStatusCode.FORBIDDEN_403)

  const game = await GameModel.loadByUUID(req.params.uuid)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const status = getModerationStatus(req.body.action, game.status)
  if (!status) return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Invalid game moderation transition' })

  const oldGame = formatGame(game)
  game.status = status
  game.moderationReason = req.body.reason || null
  game.moderatedByAccountId = user.Account.id
  game.moderatedAt = new Date()
  game.publishedAt = status === 'published' ? new Date() : null
  await game.save()
  if (game.ownerAccountId !== user.Account.id) {
    await createGameNotification({
      recipientAccountId: game.ownerAccountId,
      actorAccountId: user.Account.id,
      gameId: game.id,
      kind: 'moderation',
      message: `你的游戏审核状态已更新为：${status}`
    })
  }

  auditLogger.update(getAuditIdFromRes(res), new GameAuditView(formatGame(game)), new GameAuditView(oldGame))

  return res.json(formatGame(game))
}
