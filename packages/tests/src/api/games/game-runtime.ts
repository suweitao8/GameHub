import { expect } from 'chai'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import {
  getGameRuntimeHeaders,
  storeSingleHtmlGame,
  validateSingleHtmlGame
} from '../../../../../server/core/lib/games/game-runtime.js'

describe('Game runtime security', function () {
  it('accepts a self-contained html document and returns its sha256', function () {
    const result = validateSingleHtmlGame({
      filename: 'game.html',
      mimeType: 'text/html',
      content: Buffer.from('<!doctype html><html><body><script>document.body.textContent = "ok"</script></body></html>')
    })

    expect(result.fileSizeBytes).to.be.greaterThan(0)
    expect(result.runtimeSha256).to.match(/^[a-f0-9]{64}$/)
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

  it('returns restrictive runtime headers', function () {
    const headers = getGameRuntimeHeaders('http://localhost:9000')

    expect(headers['Content-Security-Policy']).to.contain("connect-src 'none'")
    expect(headers['Content-Security-Policy']).to.contain("frame-ancestors http://localhost:9000")
    expect(headers['Content-Security-Policy']).to.contain("form-action 'none'")
    expect(headers['X-Content-Type-Options']).to.equal('nosniff')
    expect(headers['Referrer-Policy']).to.equal('no-referrer')
  })
})
