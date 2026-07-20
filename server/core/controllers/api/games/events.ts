import { HttpStatusCode } from '@peertube/peertube-models'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { GameEventModel, GameEventParticipantModel } from '@server/models/game/game-event.js'
import { AccountModel } from '@server/models/account/account.js'
import { authenticate, asyncMiddleware, optionalAuthenticate } from '@server/middlewares/index.js'
import { apiRateLimiter } from '@server/middlewares/index.js'
import { cacheRoute } from '@server/middlewares/cache/cache.js'
import { ROUTE_CACHE_LIFETIME } from '@server/initializers/constants.js'
import express from 'express'

export const gameEventRouter = express.Router()

gameEventRouter.use(apiRateLimiter)

// Public routes
gameEventRouter.get('/', optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_LIST), asyncMiddleware(listEvents))
gameEventRouter.get('/:slug', optionalAuthenticate, cacheRoute(ROUTE_CACHE_LIFETIME.GAMES_DETAIL), asyncMiddleware(getEvent))
gameEventRouter.get('/:slug/participants', asyncMiddleware(listEventParticipants))

// Authenticated routes
gameEventRouter.post('/:slug/join', authenticate, asyncMiddleware(joinEvent))
gameEventRouter.delete('/:slug/join', authenticate, asyncMiddleware(leaveEvent))

async function listEvents (req: express.Request, res: express.Response) {
  return traceGameOperation('listEvents', async () => {
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 20))
    const start = Math.max(0, Number(req.query.start) || 0)
    const type = req.query.type as string | undefined
    const status = req.query.status as string | undefined

    const where: any = {}
    if (type) where.type = type
    if (status) where.status = status

    const events = await GameEventModel.findAll({
      where,
      include: [
        { model: AccountModel, as: 'Creator', required: true }
      ],
      order: [ [ 'startAt', 'DESC' ], [ 'createdAt', 'DESC' ] ],
      limit: count,
      offset: start
    })

    return res.json({
      total: events.length,
      data: events.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        slug: event.slug,
        type: event.type,
        status: event.status,
        coverPath: event.coverPath,
        startAt: event.startAt,
        endAt: event.endAt,
        maxParticipants: event.maxParticipants,
        participantCount: event.participantCount,
        createdBy: event.Creator ? {
          id: event.Creator.id,
          name: event.Creator.name,
          displayName: event.Creator.getDisplayName()
        } : null,
        createdAt: event.createdAt
      }))
    })
  })
}

async function getEvent (req: express.Request, res: express.Response) {
  return traceGameOperation('getEvent', async () => {
    const event = await GameEventModel.findOne({
      where: { slug: req.params.slug },
      include: [
        { model: AccountModel, as: 'Creator', required: true }
      ]
    })

    if (!event) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    return res.json({
      id: event.id,
      title: event.title,
      description: event.description,
      slug: event.slug,
      type: event.type,
      status: event.status,
      coverPath: event.coverPath,
      startAt: event.startAt,
      endAt: event.endAt,
      rules: event.rules,
      prizes: event.prizes,
      maxParticipants: event.maxParticipants,
      participantCount: event.participantCount,
      createdBy: event.Creator ? {
        id: event.Creator.id,
        name: event.Creator.name,
        displayName: event.Creator.getDisplayName()
      } : null,
      createdAt: event.createdAt
    })
  })
}

async function listEventParticipants (_req: express.Request, res: express.Response) {
  return traceGameOperation('listEventParticipants', async () => {
    const event = await GameEventModel.findOne({
      where: { slug: _req.params.slug }
    })
    if (!event) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const participants = await GameEventParticipantModel.findAll({
      where: { eventId: event.id },
      include: [
        { model: AccountModel, as: 'Account', required: true }
      ],
      order: [ [ 'createdAt', 'DESC' ] ],
      limit: 100
    })

    return res.json({
      total: participants.length,
      data: participants.map(p => ({
        id: p.id,
        account: {
          id: p.Account.id,
          name: p.Account.name,
          displayName: p.Account.getDisplayName()
        },
        state: p.state,
        rank: p.rank,
        createdAt: p.createdAt
      }))
    })
  })
}

function getUser (res: express.Response) {
  return res.locals.oauth?.token.User
}

async function joinEvent (req: express.Request, res: express.Response) {
  return traceGameOperation('joinEvent', async () => {
    const user = getUser(res)
    if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

    const event = await GameEventModel.findOne({
      where: { slug: req.params.slug }
    })
    if (!event) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    if (event.status === 'ended' || event.status === 'cancelled') {
      return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Event is not open for registration' })
    }

    const existing = await GameEventParticipantModel.findOne({
      where: { eventId: event.id, accountId: user.Account.id }
    })
    if (existing) return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Already joined' })

    await GameEventParticipantModel.create({
      eventId: event.id,
      accountId: user.Account.id,
      state: 'registered'
    })

    event.participantCount += 1
    await event.save()

    return res.status(HttpStatusCode.CREATED_201).json({ joined: true })
  })
}

async function leaveEvent (req: express.Request, res: express.Response) {
  return traceGameOperation('leaveEvent', async () => {
    const user = getUser(res)
    if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

    const event = await GameEventModel.findOne({
      where: { slug: req.params.slug }
    })
    if (!event) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const participant = await GameEventParticipantModel.findOne({
      where: { eventId: event.id, accountId: user.Account.id }
    })
    if (!participant) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    await participant.destroy()

    event.participantCount = Math.max(0, event.participantCount - 1)
    await event.save()

    return res.status(HttpStatusCode.NO_CONTENT_204).end()
  })
}
