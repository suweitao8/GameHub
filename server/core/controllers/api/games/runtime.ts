import { asyncMiddleware } from '@server/middlewares/async.js'
import { CONFIG } from '@server/initializers/config.js'
import { GameModel } from '@server/models/game/game.js'
import { getGameRuntimeHeaders, getGameRuntimeMimeType, readStoredGameCover, readStoredGameHtml, readStoredGameRuntimeFile } from '@server/lib/games/game-runtime.js'
import { readGameRuntimePreviewFile } from '@server/lib/games/game-runtime-preview.js'
import express from 'express'

const runtimeRouter = express.Router()

runtimeRouter.get('/preview/:token/runtime', asyncMiddleware(async (req, res) => {
  return sendPreviewFile(req, res, 'index.html')
}))

runtimeRouter.get('/preview/:token/runtime/*', asyncMiddleware(async (req, res) => {
  return sendPreviewFile(req, res, req.params[0])
}))

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

runtimeRouter.get('/:uuid/runtime/*', asyncMiddleware(async (req, res) => {
  const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
  if (!game) return res.sendStatus(404)

  const assetPath = req.params[0]
  const runtimeDirectory = game.runtimePath.slice(0, game.runtimePath.lastIndexOf('/'))
  const runtimePath = `${runtimeDirectory}/${assetPath}`

  try {
    const content = await readStoredGameRuntimeFile(CONFIG.STORAGE.GAMES_DIR, runtimePath)
    const parentOrigin = `${CONFIG.WEBSERVER.SCHEME}://${CONFIG.WEBSERVER.HOSTNAME}:${CONFIG.WEBSERVER.PORT}`
    const developmentOrigins = CONFIG.WEBSERVER.HOSTNAME === 'localhost'
      ? [ parentOrigin, `${CONFIG.WEBSERVER.SCHEME}://127.0.0.1:${CONFIG.WEBSERVER.PORT}` ]
      : [ parentOrigin ]

    res.removeHeader('X-Frame-Options')
    return res
      .set({ ...getGameRuntimeHeaders(developmentOrigins), 'Content-Type': getGameRuntimeMimeType(runtimePath) })
      .send(content)
  } catch {
    return res.sendStatus(404)
  }
}))

async function sendPreviewFile (req: express.Request, res: express.Response, relativePath: string) {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.token) || !relativePath) return res.sendStatus(404)

  try {
    const content = await readGameRuntimePreviewFile(CONFIG.STORAGE.GAMES_DIR, req.params.token, relativePath)
    const parentOrigin = `${CONFIG.WEBSERVER.SCHEME}://${CONFIG.WEBSERVER.HOSTNAME}:${CONFIG.WEBSERVER.PORT}`
    const developmentOrigins = CONFIG.WEBSERVER.HOSTNAME === 'localhost'
      ? [ parentOrigin, `${CONFIG.WEBSERVER.SCHEME}://127.0.0.1:${CONFIG.WEBSERVER.PORT}` ]
      : [ parentOrigin ]

    res.removeHeader('X-Frame-Options')
    return res
      .set({ ...getGameRuntimeHeaders(developmentOrigins), 'Content-Type': getGameRuntimeMimeType(relativePath) })
      .send(relativePath === 'index.html' ? injectPreviewProbe(content.toString('utf8'), req.params.token) : content)
  } catch {
    return res.sendStatus(404)
  }
}

function injectPreviewProbe (source: string, token: string) {
  const probe = `<script>(() => { const send = payload => parent.postMessage({ source: 'gamehub-upload-preview', token: ${JSON.stringify(token)}, ...payload }, '*'); window.addEventListener('error', event => send({ kind: 'error', message: event.message })); const inspect = () => { const canvas = document.querySelector('canvas'); if (canvas && canvas.width && canvas.height) send({ kind: 'canvas', dataUrl: canvas.toDataURL('image/png') }); else send({ kind: 'ready' }); }; window.addEventListener('load', () => setTimeout(inspect, 500)); setTimeout(inspect, 1500); })()</script>`
  return source.includes('</body>') ? source.replace('</body>', `${probe}</body>`) : `${source}${probe}`
}

runtimeRouter.get('/:uuid/cover', asyncMiddleware(async (req, res) => {
  const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
  if (!game?.coverPath) return res.sendStatus(404)

  const content = await readStoredGameCover(CONFIG.STORAGE.GAMES_DIR, game.coverPath)
  return res
    .set({
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    })
    .type(game.coverPath.endsWith('.png') ? 'png' : game.coverPath.endsWith('.webp') ? 'webp' : 'jpeg')
    .send(content)
}))

export {
  runtimeRouter
}
