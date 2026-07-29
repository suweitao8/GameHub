import { expect } from 'chai'
import { mkdtemp, readFile, rm } from 'fs/promises'
import JSZip from 'jszip'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import {
  getGameRuntimeHeaders,
  injectGameDefaultBackground,
  injectGameRuntimeBridge,
  storeGameRuntimePackage,
  storeSingleHtmlGame,
  validateSingleHtmlGame
} from '../../../../../server/core/lib/games/game-runtime.js'

describe('Game runtime security', function () {
  it('uses a 20 MB default limit for a single HTML file', function () {
    expect(validateSingleHtmlGame({
      filename: 'game.html',
      content: Buffer.alloc(20 * 1024 * 1024, 1)
    })).to.have.property('fileSizeBytes', 20 * 1024 * 1024)
  })

  it('accepts a self-contained html document and returns its sha256', function () {
    const result = validateSingleHtmlGame({
      filename: 'game.html',
      mimeType: 'text/html',
      content: Buffer.from('<!doctype html><html><body><script>document.body.textContent = "ok"</script></body></html>')
    })

    expect(result.fileSizeBytes).to.be.greaterThan(0)
    expect(result.runtimeSha256).to.match(/^[a-f0-9]{64}$/)
  })

  it('accepts a valid html file even when the browser sends a generic mime type', function () {
    expect(() => validateSingleHtmlGame({
      filename: 'game.html',
      mimeType: 'application/octet-stream',
      content: Buffer.from('<!doctype html><html><body>ok</body></html>')
    })).not.to.throw()
  })

  it('rejects external resources and network or top-navigation APIs', function () {
    for (const content of [
      '<script src="https://evil.test/game.js"></script>',
      '<img src="/tracking.gif">',
      '<script>fetch("https://evil.test")</script>',
      '<script>window.top.location = "https://evil.test"</script>'
    ]) {
      expect(() => validateSingleHtmlGame({ filename: 'game.html', mimeType: 'text/html', content: Buffer.from(content) }))
        .to.throw()
    }
  })

  it('rejects non-html files and files over the configured size', function () {
    expect(() => validateSingleHtmlGame({ filename: 'game.zip', mimeType: 'application/zip', content: Buffer.from('zip') }))
      .to.throw('Only a single HTML file is supported')
    expect(() => validateSingleHtmlGame({
      filename: 'game.html', mimeType: 'text/html', content: Buffer.from('<html></html>'), maxFileSizeBytes: 4
    })).to.throw('Game file is too large')
  })

  it('stores the file below a generated directory and returns a safe relative path', async function () {
    const root = await mkdtemp(join(tmpdir(), 'peertube-games-'))

    try {
      const stored = await storeSingleHtmlGame({
        root,
        filename: 'game.html',
        mimeType: 'text/html',
        content: Buffer.from('<html><body>safe</body></html>')
      })

      expect(stored.relativePath).to.match(/^[0-9a-f-]+\/index\.html$/)
      expect(resolve(root, stored.relativePath).startsWith(resolve(root))).to.equal(true)
      expect((await readFile(stored.absolutePath)).toString()).to.contain('safe')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects zip packages even when they contain a valid index file', async function () {
    const root = await mkdtemp(join(tmpdir(), 'peertube-games-'))
    const zip = new JSZip()
    zip.file('index.html', '<!doctype html><html><head><link rel="stylesheet" href="assets/game.css"></head><body><img src="assets/icon.png"><script src="assets/game.js"></script></body></html>')
    zip.file('assets/game.css', 'body { background: url("icon.png"); }')
    zip.file('assets/game.js', 'document.body.dataset.ready = "yes"')
    zip.file('assets/icon.png', Buffer.from([ 137, 80, 78, 71 ]))

    try {
      let error: Error | undefined
      try {
        await storeGameRuntimePackage({
          root,
          filename: 'game.zip',
          mimeType: 'application/zip',
          content: await zip.generateAsync({ type: 'nodebuffer' })
        })
      } catch (err) {
        error = err as Error
      }

      expect(error).to.be.instanceOf(Error)
      expect(error?.message).to.equal('Only a single HTML file is supported')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('returns restrictive runtime headers', function () {
    const headers = getGameRuntimeHeaders('http://localhost:9000')

    expect(headers['Content-Security-Policy']).to.contain("connect-src 'none'")
    expect(headers['Content-Security-Policy']).to.contain("script-src 'self' 'unsafe-inline'")
    expect(headers['Content-Security-Policy']).to.contain("img-src 'self' data: blob:")
    expect(headers['Content-Security-Policy']).to.contain("frame-ancestors http://localhost:9000")
    expect(headers['Content-Security-Policy']).to.contain("form-action 'none'")
    expect(headers['X-Content-Type-Options']).to.equal('nosniff')
    expect(headers['Referrer-Policy']).to.equal('no-referrer')
  })

  it('injects a parent-controlled audio bridge into the published document', function () {
    const source = '<!doctype html><html><body><audio></audio></body></html>'
    const bridged = injectGameRuntimeBridge(source)

    expect(bridged).to.contain('gamehub:set-volume')
    expect(bridged.indexOf('gamehub:set-volume')).to.be.lessThan(bridged.indexOf('</body>'))
    expect(bridged.match(/gamehub:set-volume/g)).to.have.length(1)
  })

  it('adds a visible fallback background when a game does not define one', function () {
    const source = '<!doctype html><html><head></head><body>game</body></html>'
    const withFallback = injectGameDefaultBackground(source)

    expect(withFallback).to.contain('data-gamehub-default-background')
    expect(withFallback).to.contain('#8f6a52')
  })

  it('preserves an explicit game background', function () {
    const source = '<!doctype html><html><head><style>body { background: #fff; }</style></head><body>game</body></html>'
    const unchanged = injectGameDefaultBackground(source)

    expect(unchanged).to.equal(source)
  })
})
