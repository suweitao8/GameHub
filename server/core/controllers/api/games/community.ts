import { apiRateLimiter } from '@server/middlewares/index.js'
import express from 'express'
import { communityCommentsRouter } from './community-comments.js'
import { communityInteractionsRouter } from './community-interactions.js'
import { communityOverviewRouter } from './community-overview.js'
import { communityReviewsRouter } from './community-reviews.js'

const gameCommunityRouter = express.Router()
gameCommunityRouter.use(apiRateLimiter)
gameCommunityRouter.use('/', communityOverviewRouter)
gameCommunityRouter.use('/', communityCommentsRouter)
gameCommunityRouter.use('/', communityReviewsRouter)
gameCommunityRouter.use('/', communityInteractionsRouter)

export { gameCommunityRouter }
