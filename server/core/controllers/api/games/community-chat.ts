import { HttpStatusCode } from '@peertube/peertube-models'
import { GameChatMessageModel } from '@server/models/game/game-chat-message.js'
import { asyncMiddleware, authenticate, gameCommentRateLimiter, optionalAuthenticate } from '@server/middlewares/index.js'
import { gameUUIDValidator } from '@server/middlewares/validators/games.js'
import express from 'express'
import { commentAccountInclude, getPublishedGame, getUser } from './community-shared.js'

const communityChatRouter = express.Router()

communityChatRouter.get('/:uuid/discussion', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(listDiscussionMessages))
communityChatRouter.post('/:uuid/discussion', gameUUIDValidator, authenticate, gameCommentRateLimiter, asyncMiddleware(addDiscussionMessage))

export { communityChatRouter }

async function listDiscussionMessages (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const start = Math.max(0, Number(req.query.start) || 0)
  const count = Math.min(100, Math.max(1, Number(req.query.count) || 50))
  const [ total, messages ] = await Promise.all([
    GameChatMessageModel.count({ where: { gameId: game.id } }),
    GameChatMessageModel.findAll({
      where: { gameId: game.id },
      include: [ commentAccountInclude ],
      order: [ [ 'createdAt', 'DESC' ] ],
      limit: count,
      offset: start
    })
  ])

  // 返回旧到新，客户端可以直接按微信聊天时间线渲染。
  messages.reverse()
  return res.json({ total, data: formatDiscussionMessages(messages) })
}

async function addDiscussionMessage (req: express.Request, res: express.Response) {
  const game = await getPublishedGame(req)
  const user = getUser(res)
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : ''
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  if (!text || text.length > 2000) {
    return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: req.t('text must contain 1-2000 characters') })
  }

  const message = await GameChatMessageModel.create({
    gameId: game.id,
    accountId: user.Account.id,
    text
  })
  const hydrated = await GameChatMessageModel.findByPk(message.id, { include: [ commentAccountInclude ] })

  return res.status(HttpStatusCode.CREATED_201).json({ message: formatDiscussionMessages([ hydrated || message ])[0] })
}

function formatDiscussionMessages (messages: GameChatMessageModel[]) {
  return messages.map(message => ({
    id: message.id,
    gameId: message.gameId,
    text: message.text,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    account: message.Account?.toFormattedJSON() || null
  }))
}
