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
    const collections = await GameCollectionModel.findAll({
      where: { status: 'published' },
      order: [ [ 'sortOrder', 'ASC' ], [ 'createdAt', 'DESC' ] ],
      limit: 50
    })

    return res.json({
      total: collections.length,
      data: collections.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        slug: c.slug,
        coverPath: c.coverPath,
        gameCount: 0
      }))
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
        { model: GameModel, required: true, include: [
          { model: AccountModel, required: true },
          { model: GameStatsSummaryModel, required: false }
        ] }
      ],
      order: [ [ 'sortOrder', 'ASC' ] ]
    })

    return res.json({
      id: collection.id,
      title: collection.title,
      description: collection.description,
      slug: collection.slug,
      coverPath: collection.coverPath,
      total: items.length,
      data: items.map(item => formatGame(item.Game))
    })
  })
}
