import { apiRateLimiter } from '@server/middlewares/index.js'
import express from 'express'
import { personalAuthorRouter } from './personal-author.js'
import { personalCreatorRouter } from './personal-creator.js'
import { personalExpRouter } from './personal-exp.js'
import { personalLibraryRouter } from './personal-library.js'
import { personalNotificationsRouter } from './personal-notifications.js'

const personalRouter = express.Router()
personalRouter.use(apiRateLimiter)
personalRouter.use('/', personalLibraryRouter)
personalRouter.use('/', personalExpRouter)
personalRouter.use('/', personalCreatorRouter)
personalRouter.use('/', personalNotificationsRouter)
personalRouter.use('/', personalAuthorRouter)

export { personalRouter }
