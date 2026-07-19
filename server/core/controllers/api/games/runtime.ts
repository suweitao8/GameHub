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
  const probe = `<script>
    (() => {
      const send = payload => parent.postMessage({ source: 'gamehub-upload-preview', token: ${JSON.stringify(token)}, ...payload }, '*')
      let captured = false
      window.addEventListener('error', event => send({ kind: 'error', message: event.message }))
      const sendCanvas = canvas => {
        if (captured || !canvas || !canvas.width || !canvas.height) return false
        try {
          captured = true
          send({ kind: 'canvas', dataUrl: canvas.toDataURL('image/png') })
          return true
        } catch {
          return false
        }
      }
      const captureDom = () => {
        if (captured) return
        const width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0, 640)
        const height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0, 360)
        const styles = Array.from(document.querySelectorAll('style')).map(style => style.textContent || '').join('\\n')
        const body = document.body?.innerHTML || document.documentElement.innerHTML
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="' + width + '" height="' + height + '"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:' + width + 'px;height:' + height + 'px;overflow:hidden;background:#f6f7f8;">' +
          '<style>' + styles.replace(/<\\/style>/gi, '') + '</style>' + body + '</div></foreignObject></svg>'
        const url = URL.createObjectURL(new Blob([ svg ], { type: 'image/svg+xml' }))
        const image = new Image()
        image.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = 1280
          canvas.height = 720
          const context = canvas.getContext('2d')
          if (!context) return URL.revokeObjectURL(url)
          context.drawImage(image, 0, 0, canvas.width, canvas.height)
          URL.revokeObjectURL(url)
          sendCanvas(canvas)
        }
        image.onerror = () => URL.revokeObjectURL(url)
        image.src = url
      }
      const inspect = () => {
        if (sendCanvas(document.querySelector('canvas'))) return
        captureDom()
        if (!captured) send({ kind: 'ready' })
      }
      window.addEventListener('load', () => setTimeout(inspect, 700))
      setTimeout(inspect, 1800)
    })()
  </script>`
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
