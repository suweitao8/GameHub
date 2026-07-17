import { HttpStatusCode } from '@peertube/peertube-models'
import { GameAuditView, auditLoggerFactory, getAuditIdFromRes } from '@server/helpers/audit-logger.js'
import { cleanUpReqFiles, createReqFiles } from '@server/helpers/express-utils.js'
import { storeGameCover, storeSingleHtmlGame, validateSingleHtmlGame } from '@server/lib/games/game-runtime.js'
import { ensureGameVideo } from '@server/lib/games/game-video-bridge.js'
import { canManageGame, getModerationStatus, isGameModerator } from '@server/lib/games/game-policy.js'
import { CONFIG } from '@server/initializers/config.js'
import { GameModel } from '@server/models/game/game.js'
import { GameFavoriteModel } from '@server/models/game/game-favorite.js'
import { GameRecentModel } from '@server/models/game/game-recent.js'
import { GameCoinLedgerModel } from '@server/models/game/game-coin-ledger.js'
import { AccountModel } from '@server/models/account/account.js'
import type { MGame } from '@server/types/models/game/game.js'
import { apiRateLimiter, asyncMiddleware, authenticate, optionalAuthenticate, paginationValidator, setDefaultPagination } from '@server/middlewares/index.js'
import { gameCreateValidator, gameListValidator, gameModerationValidator, gameUUIDValidator, parseGameTags } from '@server/middlewares/validators/games.js'
import { readFile, rm } from 'fs/promises'
import express from 'express'
import { Op } from 'sequelize'
import { runtimeRouter } from './runtime.js'
import { gameCommunityRouter } from './community.js'

const gameFile = createReqFiles([ 'gamefile', 'coverfile' ], {
  'text/html': '.html',
  'application/xhtml+xml': '.html',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp'
})

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
gamesRouter.get('/author/:accountId', optionalAuthenticate, asyncMiddleware(getAuthor))
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

async function getAuthor (req: express.Request, res: express.Response) {
  const accountId = Number(req.params.accountId)
  if (!Number.isInteger(accountId) || accountId < 1) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  const account = await AccountModel.load(accountId)
  if (!account?.Actor) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  const games = await GameModel.findAll<MGame>({
    where: { ownerAccountId: accountId, status: 'published' },
    include: [ { model: AccountModel, required: true } ],
    order: [ [ 'publishedAt', 'DESC' ] ],
    limit: 100
  })
  const [ favorites, coins ] = await Promise.all([
    GameFavoriteModel.count({ where: { gameId: games.map(game => game.id) } }),
    GameCoinLedgerModel.sum('amount', { where: { gameId: games.map(game => game.id), kind: 'spend' } })
  ])
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
      favorites,
      coins: Math.max(0, Number(coins || 0) * -1)
    },
    data: games.map(formatGame)
  })
}

async function getCreatorOverview (_req: express.Request, res: express.Response) {
  const user = getUser(res)
  const games = await GameModel.findAll<MGame>({ where: { ownerAccountId: user.Account.id }, order: [ [ 'createdAt', 'DESC' ] ] })
  const gameIds = games.map(game => game.id)
  const [ favorites, coins ] = await Promise.all([
    GameFavoriteModel.count({ where: { gameId: gameIds } }),
    GameCoinLedgerModel.sum('amount', { where: { gameId: gameIds, kind: 'spend' } })
  ])
  return res.json({
    gameCount: games.length,
    gameLimit: 5,
    storageBytes: games.reduce((sum, game) => sum + game.fileSizeBytes, 0),
    storageLimitBytes: CONFIG.GAMES.MAX_STORAGE_PER_ACCOUNT_BYTES,
    plays: games.reduce((sum, game) => sum + game.playCount, 0),
    likes: 0,
    coins: Math.max(0, Number(coins || 0) * -1),
    favorites,
    followers: 0,
    games: games.map(formatGame)
  })
}

function getRuntimeUrl (uuid: string) {
  return new URL(`/api/v1/games/${uuid}/runtime`, CONFIG.GAMES.RUNTIME_ORIGIN).toString()
}

async function listGames (req: express.Request, res: express.Response) {
  const start = Math.max(0, Number(req.query.start) || 0)
  const count = Math.min(50, Math.max(1, Number(req.query.count) || 15))
  const result = await GameModel.listPublished({
    category: req.query.category as string,
    search: req.query.search as string,
    sort: req.query.sort as string,
    limit: count,
    offset: start
  })

  return res.json({ total: result.total, data: result.data.map(formatGame) })
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
    include: [ { model: GameModel, where: { status: 'published' }, required: true } ],
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
    include: [ { model: GameModel, where: { status: 'published' }, required: true } ],
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

  let stored: Awaited<ReturnType<typeof storeSingleHtmlGame>> | undefined
  let storedCover: Awaited<ReturnType<typeof storeGameCover>> | undefined
  try {
    const content = await readFile(file.path)
    validateSingleHtmlGame({ filename: file.originalname, mimeType: file.mimetype, content, maxFileSizeBytes: CONFIG.GAMES.MAX_FILE_SIZE_BYTES })
    stored = await storeSingleHtmlGame({
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
      await rm(stored.absolutePath, { force: true })
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

    if (status === 'published') await ensureGameVideo(game)

    auditLogger.create(getAuditIdFromRes(res), new GameAuditView(formatGame(game)))

    return res.status(HttpStatusCode.CREATED_201).json(formatGame(game))
  } catch (err) {
    if (stored) await rm(stored.absolutePath, { force: true }).catch(() => undefined)
    if (storedCover) await rm(storedCover.absolutePath, { force: true }).catch(() => undefined)
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
  let stored: Awaited<ReturnType<typeof storeSingleHtmlGame>> | undefined
  let storedCover: Awaited<ReturnType<typeof storeGameCover>> | undefined
  try {
    if (file) {
      const content = await readFile(file.path)
      stored = await storeSingleHtmlGame({
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
    if (stored) await rm(stored.absolutePath, { force: true }).catch(() => undefined)
    if (storedCover) await rm(storedCover.absolutePath, { force: true }).catch(() => undefined)
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
  if (status === 'published') await ensureGameVideo(game)

  auditLogger.update(getAuditIdFromRes(res), new GameAuditView(formatGame(game)), new GameAuditView(oldGame))

  return res.json(formatGame(game))
}
