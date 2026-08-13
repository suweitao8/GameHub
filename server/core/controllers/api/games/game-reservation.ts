import { HttpStatusCode } from '@peertube/peertube-models'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import { GameModel } from '@server/models/game/game.js'
import { GameStatsSummaryModel } from '@server/models/game/game-stats-summary.js'
import { GameReserveModel } from '@server/models/game/game-reserve.js'
import { AccountModel } from '@server/models/account/account.js'
import { asyncMiddleware, authenticate } from '@server/middlewares/index.js'
import { gameUUIDValidator } from '@server/middlewares/validators/games.js'
import express from 'express'
import { Op } from 'sequelize'
import { getUser, formatGame } from './game-shared.js'

const reservationRouter = express.Router()

reservationRouter.get('/:uuid/reserve', gameUUIDValidator, authenticate, asyncMiddleware(getReservationStatus))
reservationRouter.post('/:uuid/reserve', gameUUIDValidator, authenticate, asyncMiddleware(reserveGame))
reservationRouter.delete('/:uuid/reserve', gameUUIDValidator, authenticate, asyncMiddleware(cancelReserve))
reservationRouter.get('/me/reservations', authenticate, asyncMiddleware(listReservations))

export { reservationRouter }

/** 查询当前用户是否已经预约，避免详情页只靠本地按钮状态推断服务端状态。 */
async function getReservationStatus (req: express.Request, res: express.Response) {
  return traceGameOperation('getReservationStatus', async () => {
    const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const user = getUser(res)
    const reserve = await GameReserveModel.findOne({
      where: { gameId: game.id, accountId: user.Account.id },
      attributes: [ 'id' ]
    })

    return res.json({ reserved: !!reserve })
  })
}

/**
 * 预约游戏
 */
async function reserveGame (req: express.Request, res: express.Response) {
  return traceGameOperation('reserveGame', async () => {
    const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const user = getUser(res)
    if (game.ownerAccountId === user.Account.id) {
      return res.status(HttpStatusCode.BAD_REQUEST_400).json({ error: '不能预约自己的游戏' })
    }

    const [ reserve, created ] = await GameReserveModel.findOrCreate({
      where: { gameId: game.id, accountId: user.Account.id },
      defaults: { gameId: game.id, accountId: user.Account.id, notified: false }
    })

    if (!created) return res.status(HttpStatusCode.CONFLICT_409).json({ error: '已预约' })

    return res.status(HttpStatusCode.CREATED_201).json({
      id: reserve.id,
      gameId: reserve.gameId,
      createdAt: reserve.createdAt
    })
  })
}

/**
 * 取消预约
 */
async function cancelReserve (req: express.Request, res: express.Response) {
  return traceGameOperation('cancelReserve', async () => {
    const game = await GameModel.loadByUUID(req.params.uuid)
    if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    const user = getUser(res)
    const reserve = await GameReserveModel.findOne({
      where: { gameId: game.id, accountId: user.Account.id }
    })
    if (!reserve) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    await reserve.destroy()
    return res.status(HttpStatusCode.NO_CONTENT_204).end()
  })
}

/**
 * 查询用户预约列表
 */
async function listReservations (_req: express.Request, res: express.Response) {
  return traceGameOperation('listReservations', async () => {
    const user = getUser(res)
    const rows = await GameReserveModel.findAll({
      where: { accountId: user.Account.id },
      include: [
        {
          model: GameModel,
          where: { status: { [Op.ne]: 'blocked' } },
          required: true,
          include: [
            { model: AccountModel, required: true },
            { model: GameStatsSummaryModel, required: false }
          ]
        }
      ],
      order: [ [ 'createdAt', 'DESC' ] ]
    })

    return res.json({
      total: rows.length,
      data: rows.map(row => ({
        id: row.id,
        notified: row.notified,
        createdAt: row.createdAt,
        game: formatGame(row.Game)
      }))
    })
  })
}
