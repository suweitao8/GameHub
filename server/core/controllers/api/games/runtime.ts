import { asyncMiddleware } from '@server/middlewares/async.js'
import { CONFIG } from '@server/initializers/config.js'
import { GameModel } from '@server/models/game/game.js'
import {
  getGameRuntimeHeaders,
  getGameRuntimeMimeType,
  injectGameDefaultBackground,
  injectGameRuntimeBridge,
  readStoredGameCover,
  readStoredGameScreenshot,
  readStoredGameHtml,
  readStoredGameRuntimeFile,
  verifyGameRuntimeHash
} from '@server/lib/games/game-runtime.js'
import { readGameRuntimePreviewFile } from '@server/lib/games/game-runtime-preview.js'
import { generateGameAssetETag, getGameCoverCacheHeaders, getGameRuntimeAssetCacheHeaders, verifyGameSignedUrl } from '@server/lib/games/game-cdn.js'
import { traceGameOperation } from '@server/lib/games/game-tracing.js'
import express from 'express'

const runtimeRouter = express.Router()

runtimeRouter.get('/preview/:token/runtime', asyncMiddleware(async (req, res) => {
  return sendPreviewFile(req, res, 'index.html')
}))

runtimeRouter.get('/preview/:token/runtime/*', asyncMiddleware(async (req, res) => {
  return sendPreviewFile(req, res, req.params[0])
}))

runtimeRouter.get('/:uuid/runtime', asyncMiddleware(async (req, res) => {
  return traceGameOperation('serveRuntime', async () => {
    const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
    if (!game) return res.sendStatus(404)

    const hashValid = await verifyGameRuntimeHash(CONFIG.STORAGE.GAMES_DIR, game.runtimePath, game.runtimeSha256)
    if (!hashValid) {
      return res.status(500).json({ error: 'Game runtime integrity verification failed' })
    }

    const content = await readStoredGameHtml(CONFIG.STORAGE.GAMES_DIR, game.runtimePath)
    const parentOrigin = `${CONFIG.WEBSERVER.SCHEME}://${CONFIG.WEBSERVER.HOSTNAME}:${CONFIG.WEBSERVER.PORT}`
    const developmentOrigins = CONFIG.WEBSERVER.HOSTNAME === 'localhost'
      ? [ parentOrigin, `${CONFIG.WEBSERVER.SCHEME}://127.0.0.1:${CONFIG.WEBSERVER.PORT}` ]
      : [ parentOrigin ]

    res.removeHeader('X-Frame-Options')

    return res
      .set(getGameRuntimeHeaders(developmentOrigins))
      .send(injectGameRuntimeBridge(content.toString('utf8')))
  })
}))

runtimeRouter.get('/:uuid/runtime/*', asyncMiddleware(async (req, res) => {
  return traceGameOperation('serveRuntimeAsset', async () => {
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

      const etag = generateGameAssetETag(game.runtimeSha256, runtimePath)

      // Support conditional requests via If-None-Match
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).set({ 'Cache-Control': 'public, max-age=3600' }).end()
      }

      res.removeHeader('X-Frame-Options')
      return res
        .set({
          ...getGameRuntimeHeaders(developmentOrigins),
          ...getGameRuntimeAssetCacheHeaders(),
          'Content-Type': getGameRuntimeMimeType(runtimePath),
          etag
        })
        .send(content)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return res.sendStatus(404)
      }
      throw error
    }
  })
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
      .send(relativePath === 'index.html' ? injectPreviewProbe(injectGameDefaultBackground(content.toString('utf8')), req.params.token) : content)
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
          const dataUrl = canvas.toDataURL('image/png')
          captured = true
          send({ kind: 'canvas', dataUrl })
          return true
        } catch {
          return false
        }
      }
      const renderDomToCanvas = () => {
        if (captured) return true
        const width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0, 640)
        const height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0, 360)
        const canvas = document.createElement('canvas')
        canvas.width = 1280
        canvas.height = 720
        const context = canvas.getContext('2d')
        const body = document.body
        if (!context || !body) return false
        const scaleX = canvas.width / width
        const scaleY = canvas.height / height
        const getColor = value => value && value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)' ? value : ''
        const visible = element => {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0
        }
        const elements = Array.from(document.querySelectorAll('body *')).filter(visible).slice(0, 100)
        context.save()
        context.scale(scaleX, scaleY)
        context.fillStyle = getColor(getComputedStyle(body).backgroundColor) || '#f6f7f8'
        context.fillRect(0, 0, width, height)
        elements.forEach(element => {
          const style = getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          const background = getColor(style.backgroundColor)
          if (background) {
            context.fillStyle = background
            context.beginPath()
            if (typeof context.roundRect === 'function') context.roundRect(rect.x, rect.y, rect.width, rect.height, parseFloat(style.borderRadius) || 0)
            else context.rect(rect.x, rect.y, rect.width, rect.height)
            context.fill()
          }
          if (style.borderStyle !== 'none' && parseFloat(style.borderTopWidth) > 0) {
            context.strokeStyle = getColor(style.borderTopColor) || '#d9dce1'
            context.lineWidth = parseFloat(style.borderTopWidth)
            context.strokeRect(rect.x, rect.y, rect.width, rect.height)
          }
        })
        elements.filter(element => element.children.length === 0 || /^(H1|H2|H3|BUTTON|LABEL)$/.test(element.tagName)).forEach(element => {
          const text = (element.textContent || '').replace(/[ \t\r\n]+/g, ' ').trim().slice(0, 180)
          if (!text) return
          const style = getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          const fontSize = Math.max(12, parseFloat(style.fontSize) || 16)
          const lineHeight = Math.max(fontSize * 1.25, parseFloat(style.lineHeight) || fontSize * 1.25)
          const maxWidth = Math.max(40, rect.width - 8)
          context.fillStyle = getColor(style.color) || '#30343b'
          context.font = (style.fontWeight || '400') + ' ' + fontSize + 'px ' + (style.fontFamily || 'Arial')
          context.textBaseline = 'top'
          let line = ''
          let lineY = rect.y
          let lineCount = 0
          for (const character of Array.from(text)) {
            const next = line + character
            if (line && context.measureText(next).width > maxWidth) {
              context.fillText(line, rect.x, lineY)
              line = character
              lineY += lineHeight
              lineCount += 1
              if (lineCount >= 4) break
            } else {
              line = next
            }
          }
          if (line && lineCount < 4) context.fillText(line, rect.x, lineY)
        })
        context.restore()
        return sendCanvas(canvas)
      }
      const captureDom = () => {
        if (captured) return true
        return renderDomToCanvas()
      }
        const inspect = () => {
          if (sendCanvas(document.querySelector('canvas'))) return
          captureDom()
        }
      window.addEventListener('load', () => setTimeout(inspect, 700))
      setTimeout(inspect, 1800)
    })()
  </script>`
  return /<\/body>/i.test(source) ? source.replace(/<\/body>/i, `${probe}</body>`) : `${source}${probe}`
}

runtimeRouter.get('/:uuid/cover', asyncMiddleware(async (req, res) => {
  return traceGameOperation('serveCover', async () => {
    const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
    if (!game?.coverPath) return res.sendStatus(404)

    // Validate signed URL if signature is present
    const sig = req.query.sig as string | undefined
    const expires = req.query.expires as string | undefined
    if (sig && expires) {
      const valid = verifyGameSignedUrl({
        uuid: req.params.uuid,
        path: req.originalUrl.split('?')[0],
        signature: sig,
        expires: parseInt(expires, 10)
      })
      if (!valid) return res.sendStatus(403)
    }

    let content: Buffer
    try {
      content = await readStoredGameCover(CONFIG.STORAGE.GAMES_DIR, game.coverPath)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        // 历史数据可能只保留了封面路径，文件已被清理时按无封面处理。
        return res.sendStatus(404)
      }
      throw error
    }
    const etag = generateGameAssetETag(game.runtimeSha256, game.coverPath)

    // Support conditional requests via If-None-Match
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).set({ 'Cache-Control': 'public, max-age=86400' }).end()
    }

    return res
      .set({
        ...getGameCoverCacheHeaders(),
        etag
      })
      .type(game.coverPath.endsWith('.png') ? 'png' : game.coverPath.endsWith('.webp') ? 'webp' : 'jpeg')
      .send(content)
  })
}))

runtimeRouter.get('/:uuid/screenshots/:index', asyncMiddleware(async (req, res) => {
  return traceGameOperation('serveScreenshot', async () => {
    const game = await GameModel.loadByUUID(req.params.uuid, { publishedOnly: true })
    if (!game?.screenshotPaths?.length) return res.sendStatus(404)

    const index = parseInt(req.params.index, 10)
    if (isNaN(index) || index < 0 || index >= game.screenshotPaths.length) return res.sendStatus(404)

    const screenshotPath = game.screenshotPaths[index]

    // Validate signed URL if signature is present
    const sig = req.query.sig as string | undefined
    const expires = req.query.expires as string | undefined
    if (sig && expires) {
      const valid = verifyGameSignedUrl({
        uuid: req.params.uuid,
        path: req.originalUrl.split('?')[0],
        signature: sig,
        expires: parseInt(expires, 10)
      })
      if (!valid) return res.sendStatus(403)
    }

    const content = await readStoredGameScreenshot(CONFIG.STORAGE.GAMES_DIR, screenshotPath)
    const etag = generateGameAssetETag(game.runtimeSha256, screenshotPath)

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).set({ 'Cache-Control': 'public, max-age=86400' }).end()
    }

    return res
      .set({
        ...getGameCoverCacheHeaders(),
        etag
      })
      .type(screenshotPath.endsWith('.png') ? 'png' : screenshotPath.endsWith('.webp') ? 'webp' : 'jpeg')
      .send(content)
  })
}))

export {
  runtimeRouter
}
