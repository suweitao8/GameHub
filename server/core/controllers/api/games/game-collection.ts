import { HttpStatusCode } from '@peertube/peertube-models'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { ROUTE_CACHE_LIFETIME } from '@server/initializers/constants.js'
import { GameModel } from '@server/models/game/game.js'
import { GameStatsSummaryModel } from '@server/models/game/game-stats-summary.js'
import { GameCollectionModel, GameCollectionItemModel } from '@server/models/game/game-collection.js'
import { AccountModel } from '@server/models/account/account.js'
import { asyncMiddleware, optionalAuthenticate } from '@server/middlewares/index.js'
import { cacheRoute } from '@server/middlewares/cache/cache.js'
import express from 'express'
import { col, fn } from 'sequelize'
import { formatGame } from './game-shared.js'

const collectionRouter = express.Router()

collectionRouter.get('/collections', optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_LIST), asyncMiddleware(listCollections))
collectionRouter.get('/collections/:slug', optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_DETAIL), asyncMiddleware(getCollection))

export { collectionRouter }

/**
 * 专题合集列表
 */
async function listCollections (req: express.Request, res: express.Response) {
  return traceGameOperation('listCollections', async () => {
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 50))
    const start = Math.max(0, Number(req.query.start) || 0)
    const { count: total, rows: collections } = await GameCollectionModel.findAndCountAll({
      where: { status: 'published' },
      order: [ [ 'sortOrder', 'ASC' ], [ 'createdAt', 'DESC' ] ],
      limit: count,
      offset: start
    })
    const gameCountByCollection = await getPublishedGameCountByCollection(collections.map(collection => collection.id))

    return res.json({
      total,
      data: collections.map(collection => formatCollection(collection, gameCountByCollection.get(collection.id) || 0))
    })
  })
}

/**
 * 专题合集详情
 */
async function getCollection (req: express.Request, res: express.Response) {
  return traceGameOperation('getCollection', async () => {
    const slug = req.params.slug
    const collection = await GameCollectionModel.findOne({
      where: { slug, status: 'published' }
    })

    if (!collection) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const items = await GameCollectionItemModel.findAll({
      where: { collectionId: collection.id },
      include: [
        { model: GameModel, required: true, where: { status: 'published' }, include: [
          { model: AccountModel, required: true },
          { model: GameStatsSummaryModel, required: false }
        ] }
      ],
      order: [ [ 'sortOrder', 'ASC' ] ]
    })

    return res.json({
      ...formatCollection(collection, items.length),
      total: items.length,
      data: items.map(item => formatGame(item.Game))
    })
  })
}

async function getPublishedGameCountByCollection (collectionIds: number[]) {
  if (collectionIds.length === 0) return new Map<number, number>()

  const gameCounts = await GameCollectionItemModel.findAll<any>({
    where: { collectionId: collectionIds },
    attributes: [ 'collectionId', [ fn('COUNT', col('Game.id')), 'gameCount' ] ],
    include: [
      { model: GameModel, required: true, where: { status: 'published' }, attributes: [] }
    ],
    group: [ 'collectionId' ],
    raw: true
  })

  return new Map(gameCounts.map(row => [ Number(row.collectionId), Number(row.gameCount) ]))
}

function formatCollection (collection: GameCollectionModel, gameCount: number) {
  return {
    id: collection.id,
    title: collection.title,
    description: collection.description,
    slug: collection.slug,
    coverPath: collection.coverPath,
    gameCount,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt
  }
}
