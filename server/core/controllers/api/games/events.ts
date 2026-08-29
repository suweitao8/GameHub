import { HttpStatusCode } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { isGameModerator } from '@server/lib/games/game-policy.js'
import { GameEventModel, GameEventParticipantModel } from '@server/models/game/game-event.js'
import { AccountModel } from '@server/models/account/account.js'
import { authenticate, asyncMiddleware, optionalAuthenticate, apiRateLimiter } from '@server/middlewares/index.js'
import express from 'express'
import { type WhereOptions } from 'sequelize'

const MAX_EVENT_TITLE_LENGTH = 120
const MAX_EVENT_SLUG_LENGTH = 120
const MAX_EVENT_TEXT_LENGTH = 20000
const MAX_EVENT_COVER_LENGTH = 2048
const EVENT_SLUG_PATTERN = /^[a-z0-9\u4e00-\u9fff]+(?:-[a-z0-9\u4e00-\u9fff]+)*$/

type EventMutationResult =
  | { status: 404 }
  | { status: 409, error: string }
  | { status: 200 | 201, participantCount: number }

export const gameEventRouter = express.Router()

gameEventRouter.use(apiRateLimiter)

// Public routes
gameEventRouter.get('/', optionalAuthenticate, asyncMiddleware(listEvents))
gameEventRouter.get('/:slug', optionalAuthenticate, asyncMiddleware(getEvent))
gameEventRouter.get('/:slug/participants', asyncMiddleware(listEventParticipants))

// Authenticated routes
gameEventRouter.get('/:slug/participation', authenticate, asyncMiddleware(getEventParticipation))
gameEventRouter.post('/:slug/join', authenticate, asyncMiddleware(joinEvent))
gameEventRouter.delete('/:slug/join', authenticate, asyncMiddleware(leaveEvent))

// Event management routes
gameEventRouter.post('/', authenticate, asyncMiddleware(createEvent))
gameEventRouter.put('/:slug', authenticate, asyncMiddleware(updateEvent))
gameEventRouter.delete('/:slug', authenticate, asyncMiddleware(deleteEvent))

async function listEvents (req: express.Request, res: express.Response) {
  return traceGameOperation('listEvents', async () => {
    const count = Math.min(50, Math.max(1, Number(req.query.count) || 20))
    const start = Math.max(0, Number(req.query.start) || 0)
    const type = req.query.type as string | undefined
    const status = req.query.status as string | undefined

    const where: WhereOptions = {
      ...(type ? { type } : {}),
      ...(status ? { status } : {})
    }

    const { count: total, rows: events } = await GameEventModel.findAndCountAll({
      where,
      include: [
        { model: AccountModel, as: 'Creator', required: true }
      ],
      order: [ [ 'startAt', 'DESC' ], [ 'createdAt', 'DESC' ] ],
      limit: count,
      offset: start
    })

    return res.json({
      total,
      data: events.map(event => formatEvent(event))
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

    return res.json(formatEvent(event))
  })
}

async function listEventParticipants (_req: express.Request, res: express.Response) {
  return traceGameOperation('listEventParticipants', async () => {
    const count = Math.min(100, Math.max(1, Number(_req.query.count) || 100))
    const start = Math.max(0, Number(_req.query.start) || 0)
    const event = await GameEventModel.findOne({
      where: { slug: _req.params.slug }
    })
    if (!event) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const { count: total, rows: participants } = await GameEventParticipantModel.findAndCountAll({
      where: { eventId: event.id },
      include: [
        { model: AccountModel, as: 'Account', required: true }
      ],
      order: [ [ 'createdAt', 'DESC' ] ],
      limit: count,
      offset: start
    })

    return res.json({
      total,
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

function formatEvent (
  event: GameEventModel,
  creator: Pick<AccountModel, 'id' | 'name' | 'getDisplayName'> | null | undefined = event.Creator
) {
  return {
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
    createdBy: creator ? {
      id: creator.id,
      name: creator.name,
      displayName: creator.getDisplayName()
    } : null,
    createdAt: event.createdAt
  }
}

function normalizeMaxParticipants (value: unknown) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0
}

function normalizeEventText (value: unknown, label: string, maxLength = MAX_EVENT_TEXT_LENGTH) {
  if (value === undefined) return { value: undefined }
  if (value === null || value === '') return { value: null }
  if (typeof value !== 'string') return { error: `${label}格式不正确` }

  const text = value.trim()
  if (text.length > maxLength) return { error: `${label}不能超过 ${maxLength} 个字符` }
  return { value: text || null }
}

function normalizeEventCover (value: unknown) {
  const normalized = normalizeEventText(value, '封面地址', MAX_EVENT_COVER_LENGTH)
  if ('error' in normalized || normalized.value === undefined || normalized.value === null) return normalized
  if (!normalized.value.startsWith('/') && !/^https?:\/\//i.test(normalized.value)) {
    return { error: '封面地址必须是站内路径或 http(s) 地址' }
  }
  return normalized
}

function normalizeEventSlug (value: unknown) {
  if (typeof value !== 'string') return { error: 'Slug 格式不正确' }
  const slug = value.trim().toLocaleLowerCase('en-US')
  if (!slug || slug.length > MAX_EVENT_SLUG_LENGTH || !EVENT_SLUG_PATTERN.test(slug)) {
    return { error: 'Slug 只能使用字母、数字、中文和连字符，且长度不能超过 120 个字符' }
  }
  return { value: slug }
}

function normalizeEventTitle (value: unknown) {
  if (typeof value !== 'string') return { error: '标题不能为空' }
  const title = value.trim()
  if (!title) return { error: '标题不能为空' }
  if (title.length > MAX_EVENT_TITLE_LENGTH) return { error: `标题不能超过 ${MAX_EVENT_TITLE_LENGTH} 个字符` }
  return { value: title }
}

function normalizeEventStatus (value: unknown): GameEventModel['status'] | null {
  return value === 'upcoming' || value === 'ongoing' || value === 'ended' || value === 'cancelled' ? value : null
}

function normalizeEventType (value: unknown): GameEventModel['type'] | null {
  return value === 'activity' || value === 'competition' ? value : null
}

function normalizeEventDate (value: unknown) {
  if (value === undefined || value === null || value === '') return { value: null as Date | null }
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? { error: '活动时间格式不正确' } : { value: date }
}

function validateEventWindow (startAt: Date | null, endAt: Date | null) {
  if (startAt && endAt && endAt < startAt) return '结束时间不能早于开始时间'
  return null
}

async function getEventParticipation (req: express.Request, res: express.Response) {
  return traceGameOperation('getEventParticipation', async () => {
    const user = getUser(res)
    if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

    const event = await GameEventModel.findOne({
      where: { slug: req.params.slug },
      attributes: [ 'id' ]
    })
    if (!event) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const participant = await GameEventParticipantModel.findOne({
      where: { eventId: event.id, accountId: user.Account.id },
      attributes: [ 'id' ]
    })

    return res.json({ joined: !!participant })
  })
}

async function joinEvent (req: express.Request, res: express.Response) {
  return traceGameOperation('joinEvent', async () => {
    const user = getUser(res)
    if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

    const result = await retryTransactionWrapper(() => {
      return sequelizeTypescript.transaction(async transaction => {
        const event = await GameEventModel.findOne({
          where: { slug: req.params.slug },
          transaction,
          lock: transaction.LOCK.UPDATE
        })
        if (!event) return { status: HttpStatusCode.NOT_FOUND_404 } satisfies EventMutationResult

        if (event.status === 'ended' || event.status === 'cancelled') {
          return { status: HttpStatusCode.CONFLICT_409, error: req.t('Event is not open for registration') } satisfies EventMutationResult
        }

        const existing = await GameEventParticipantModel.findOne({
          where: { eventId: event.id, accountId: user.Account.id },
          transaction
        })
        if (existing) return { status: HttpStatusCode.CONFLICT_409, error: req.t('Already joined') } satisfies EventMutationResult

        if (event.maxParticipants > 0 && event.participantCount >= event.maxParticipants) {
          return { status: HttpStatusCode.CONFLICT_409, error: req.t('Event is full') } satisfies EventMutationResult
        }

        await GameEventParticipantModel.create({
          eventId: event.id,
          accountId: user.Account.id,
          state: 'registered'
        }, { transaction })

        event.participantCount += 1
        await event.save({ transaction })

        return { status: HttpStatusCode.CREATED_201, participantCount: event.participantCount } satisfies EventMutationResult
      })
    })

    if ('error' in result) return res.status(result.status).json({ error: result.error })
    if (!('participantCount' in result)) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    return res.status(HttpStatusCode.CREATED_201).json({ joined: true, participantCount: result.participantCount })
  })
}

async function leaveEvent (req: express.Request, res: express.Response) {
  return traceGameOperation('leaveEvent', async () => {
    const user = getUser(res)
    if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

    const result = await retryTransactionWrapper(() => {
      return sequelizeTypescript.transaction(async transaction => {
        const event = await GameEventModel.findOne({
          where: { slug: req.params.slug },
          transaction,
          lock: transaction.LOCK.UPDATE
        })
        if (!event) return { status: HttpStatusCode.NOT_FOUND_404 } satisfies EventMutationResult

        const participant = await GameEventParticipantModel.findOne({
          where: { eventId: event.id, accountId: user.Account.id },
          transaction
        })
        if (!participant) return { status: HttpStatusCode.NOT_FOUND_404 } satisfies EventMutationResult

        await participant.destroy({ transaction })

        event.participantCount = Math.max(0, event.participantCount - 1)
        await event.save({ transaction })

        return { status: HttpStatusCode.OK_200, participantCount: event.participantCount } satisfies EventMutationResult
      })
    })

    if (!('participantCount' in result)) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    return res.json({ joined: false, participantCount: result.participantCount })
  })
}

async function createEvent (req: express.Request, res: express.Response) {
  return traceGameOperation('createEvent', async () => {
    const user = getUser(res)
    if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: '请求内容格式不正确' })
    }
    const { title, description, slug, type, status, coverPath, startAt, endAt, rules, prizes, maxParticipants } = req.body
    const normalizedTitle = normalizeEventTitle(title)
    const normalizedSlug = normalizeEventSlug(slug)
    const normalizedDescription = normalizeEventText(description, '描述')
    const normalizedRules = normalizeEventText(rules, '规则')
    const normalizedPrizes = normalizeEventText(prizes, '奖品')
    const normalizedCoverPath = normalizeEventCover(coverPath)
    if ('error' in normalizedTitle) return res.status(HttpStatusCode.BAD_REQUEST_400).json(normalizedTitle)
    if ('error' in normalizedSlug) return res.status(HttpStatusCode.BAD_REQUEST_400).json(normalizedSlug)
    if ('error' in normalizedDescription) return res.status(HttpStatusCode.BAD_REQUEST_400).json(normalizedDescription)
    if ('error' in normalizedRules) return res.status(HttpStatusCode.BAD_REQUEST_400).json(normalizedRules)
    if ('error' in normalizedPrizes) return res.status(HttpStatusCode.BAD_REQUEST_400).json(normalizedPrizes)
    if ('error' in normalizedCoverPath) return res.status(HttpStatusCode.BAD_REQUEST_400).json(normalizedCoverPath)

    const normalizedType = type === undefined ? 'activity' : normalizeEventType(type)
    const normalizedStatus = status === undefined ? 'upcoming' : normalizeEventStatus(status)
    const normalizedStartAt = normalizeEventDate(startAt)
    const normalizedEndAt = normalizeEventDate(endAt)
    if (!normalizedType || !normalizedStatus) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: '活动类型或状态不正确' })
    if ('error' in normalizedStartAt) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: normalizedStartAt.error })
    if ('error' in normalizedEndAt) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: normalizedEndAt.error })
    const windowError = validateEventWindow(normalizedStartAt.value, normalizedEndAt.value)
    if (windowError) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: windowError })

    try {
      const event = await GameEventModel.create({
        title: normalizedTitle.value,
        description: normalizedDescription.value ?? null,
        slug: normalizedSlug.value,
        type: normalizedType,
        status: normalizedStatus,
        coverPath: normalizedCoverPath.value ?? null,
        startAt: normalizedStartAt.value,
        endAt: normalizedEndAt.value,
        rules: normalizedRules.value ?? null,
        prizes: normalizedPrizes.value ?? null,
        maxParticipants: normalizeMaxParticipants(maxParticipants),
        participantCount: 0,
        createdByAccountId: user.Account.id
      })

      const creator = await AccountModel.findByPk(event.createdByAccountId)
      return res.status(HttpStatusCode.CREATED_201).json(formatEvent(event, creator))
    } catch (error) {
      if (error instanceof Error && error.name === 'SequelizeUniqueConstraintError') {
        return res.status(HttpStatusCode.CONFLICT_409).json({ error: 'Slug 已被使用，请换一个' })
      }
      throw error
    }
  })
}

async function updateEvent (req: express.Request, res: express.Response) {
  return traceGameOperation('updateEvent', async () => {
    const user = getUser(res)
    if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

    const event = await GameEventModel.findOne({
      where: { slug: req.params.slug },
      include: [
        { model: AccountModel, as: 'Creator', required: true }
      ]
    })
    if (!event) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    // Only creator or admin can update
    if (!isGameModerator(user) && event.createdByAccountId !== user.Account.id) {
      return res.sendStatus(HttpStatusCode.FORBIDDEN_403)
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: '请求内容格式不正确' })
    }
    const { title, description, type, status, coverPath, startAt, endAt, rules, prizes, maxParticipants } = req.body

    if (title !== undefined) {
      const normalizedTitle = normalizeEventTitle(title)
      if ('error' in normalizedTitle) return res.status(HttpStatusCode.BAD_REQUEST_400).json(normalizedTitle)
      event.title = normalizedTitle.value
    }
    if (description !== undefined) {
      const normalizedDescription = normalizeEventText(description, '描述')
      if ('error' in normalizedDescription) return res.status(HttpStatusCode.BAD_REQUEST_400).json(normalizedDescription)
      event.description = normalizedDescription.value ?? null
    }
    if (type !== undefined) {
      const normalizedType = normalizeEventType(type)
      if (!normalizedType) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: '活动类型不正确' })
      event.type = normalizedType
    }
    if (status !== undefined) {
      const normalizedStatus = normalizeEventStatus(status)
      if (!normalizedStatus) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: '活动状态不正确' })
      event.status = normalizedStatus
    }
    if (coverPath !== undefined) {
      const normalizedCoverPath = normalizeEventCover(coverPath)
      if ('error' in normalizedCoverPath) return res.status(HttpStatusCode.BAD_REQUEST_400).json(normalizedCoverPath)
      event.coverPath = normalizedCoverPath.value ?? null
    }
    if (startAt !== undefined) {
      const normalizedStartAt = normalizeEventDate(startAt)
      if ('error' in normalizedStartAt) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: normalizedStartAt.error })
      event.startAt = normalizedStartAt.value
    }
    if (endAt !== undefined) {
      const normalizedEndAt = normalizeEventDate(endAt)
      if ('error' in normalizedEndAt) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: normalizedEndAt.error })
      event.endAt = normalizedEndAt.value
    }
    const windowError = validateEventWindow(event.startAt, event.endAt)
    if (windowError) return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: windowError })
    if (rules !== undefined) {
      const normalizedRules = normalizeEventText(rules, '规则')
      if ('error' in normalizedRules) return res.status(HttpStatusCode.BAD_REQUEST_400).json(normalizedRules)
      event.rules = normalizedRules.value ?? null
    }
    if (prizes !== undefined) {
      const normalizedPrizes = normalizeEventText(prizes, '奖品')
      if ('error' in normalizedPrizes) return res.status(HttpStatusCode.BAD_REQUEST_400).json(normalizedPrizes)
      event.prizes = normalizedPrizes.value ?? null
    }
    if (maxParticipants !== undefined) event.maxParticipants = normalizeMaxParticipants(maxParticipants)

    await event.save()

    return res.json(formatEvent(event))
  })
}

async function deleteEvent (req: express.Request, res: express.Response) {
  return traceGameOperation('deleteEvent', async () => {
    const user = getUser(res)
    if (!user) return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)

    const event = await GameEventModel.findOne({
      where: { slug: req.params.slug }
    })
    if (!event) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    // Only creator or admin can delete
    if (!isGameModerator(user) && event.createdByAccountId !== user.Account.id) {
      return res.sendStatus(HttpStatusCode.FORBIDDEN_403)
    }

    await event.destroy()
    return res.status(HttpStatusCode.NO_CONTENT_204).end()
  })
}
