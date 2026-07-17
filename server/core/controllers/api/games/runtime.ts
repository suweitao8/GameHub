import { asyncMiddleware } from '@server/middlewares/async.js'
import { CONFIG } from '@server/initializers/config.js'
import { GameModel } from '@server/models/game/game.js'
import { getGameRuntimeHeaders, readStoredGameHtml } from '@server/lib/games/game-runtime.js'
import express from 'express'

const runtimeRouter = express.Router()

runtimeRouter.get('/:uuid/runtime', asyncMiddleware(async (req, res) => {
  const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
  if (!game) return res.sendStatus(404)

  const content = await readStoredGameHtml(CONFIG.STORAGE.GAMES_DIR, game.runtimePath)
  const parentOrigin = `${CONFIG.WEBSERVER.SCHEME}://${CONFIG.WEBSERVER.HOSTNAME}:${CONFIG.WEBSERVER.PORT}`
  const developmentOrigins = CONFIG.WEBSERVER.HOSTNAME === 'localhost'
    ? [ parentOrigin, `${CONFIG.WEBSERVER.SCHEME}://127.0.0.1:${CONFIG.WEBSERVER.PORT}` ]
    : [ parentOrigin ]

  res.removeHeader('X-Frame-Options')

  return res
    .set(getGameRuntimeHeaders(developmentOrigins))
    .send(content)
}))

export {
  runtimeRouter
}
