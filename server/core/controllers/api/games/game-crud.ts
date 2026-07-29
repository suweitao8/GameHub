import { apiRateLimiter } from '@server/middlewares/index.js'
import express from 'express'
import { createRouter as gameCrudCreateRouter } from './game-crud-create.js'
import { queryRouter as gameCrudQueryRouter } from './game-crud-query.js'
import { updateRouter as gameCrudUpdateRouter } from './game-crud-update.js'

const crudRouter = express.Router()
crudRouter.use(apiRateLimiter)
crudRouter.use('/', gameCrudQueryRouter)
crudRouter.use('/', gameCrudCreateRouter)
crudRouter.use('/', gameCrudUpdateRouter)

export { crudRouter }
