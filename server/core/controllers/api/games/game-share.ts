import { HttpStatusCode } from '@peertube/peertube-models'
import { createGameShareToken, resolveGameShareToken } from '@server/lib/games/game-share.js'
import { GameModel } from '@server/models/game/game.js'
import { GameStatsSummaryModel } from '@server/models/game/game-stats-summary.js'
import { asyncMiddleware, optionalAuthenticate } from '@server/middlewares/index.js'
import { gameUUIDValidator } from '@server/middlewares/validators/games.js'
import express from 'express'

const shareRouter = express.Router()

shareRouter.get('/s/:token', asyncMiddleware(resolveShare))
shareRouter.post('/:uuid/share', gameUUIDValidator, optionalAuthenticate, asyncMiddleware(shareGame))

export { shareRouter }

async function shareGame (req: express.Request, res: express.Response) {
  const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const shareInfo = await createGameShareToken(game.uuid)
  const [ stats ] = await GameStatsSummaryModel.findOrCreate({
    where: { gameId: game.id },
    defaults: { gameId: game.id }
  })
  await stats.increment('shares')
  return res.json(shareInfo)
}

async function resolveShare (req: express.Request, res: express.Response) {
  const uuid = await resolveGameShareToken(req.params.token)
  if (!uuid) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  const game = await GameModel.loadByUUID(uuid, { publishedOnly: true })
  if (!game) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

  return res.redirect(`/games/${uuid}`)
}
