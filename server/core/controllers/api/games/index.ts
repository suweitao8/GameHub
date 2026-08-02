import { apiRateLimiter } from '@server/middlewares/index.js'
import express from 'express'
import { runtimeRouter } from './runtime.js'
import { gameCommunityRouter } from './community.js'
import { gameEventRouter } from './events.js'
import { crudRouter } from './game-crud.js'
import { discoveryRouter } from './game-discovery.js'
import { personalRouter } from './game-personal.js'
import { reservationRouter } from './game-reservation.js'
import { collectionRouter } from './game-collection.js'
import { moderationRouter } from './game-moderation.js'
import { shareRouter } from './game-share.js'

const gamesRouter = express.Router()
gamesRouter.use(apiRateLimiter)
gamesRouter.use('/', runtimeRouter)
gamesRouter.use('/', gameCommunityRouter)
gamesRouter.use('/events', gameEventRouter)
gamesRouter.use('/', discoveryRouter)
gamesRouter.use('/', personalRouter)
gamesRouter.use('/', reservationRouter)
gamesRouter.use('/', collectionRouter)
// Register static namespaces before the parameterized /:uuid CRUD routes.
// Otherwise paths such as /featured, /collections, and /me/* are consumed by
// the UUID validator and never reach their intended controller.
gamesRouter.use('/', discoveryRouter)
gamesRouter.use('/', personalRouter)
gamesRouter.use('/', reservationRouter)
gamesRouter.use('/', collectionRouter)
gamesRouter.use('/', crudRouter)
gamesRouter.use('/', moderationRouter)
gamesRouter.use('/', shareRouter)

export {
  gamesRouter
}
