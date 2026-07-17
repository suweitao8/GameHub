import { expect } from 'chai'
import { mkdtemp, readFile, rm } from 'fs/promises'
import JSZip from 'jszip'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import {
  getGameRuntimeHeaders,
  readStoredGameRuntimeFile,
  storeGameRuntimePackage,
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

  it('stores a zip package with relative resources and serves files below its runtime directory', async function () {
    const root = await mkdtemp(join(tmpdir(), 'peertube-games-'))
    const zip = new JSZip()
    zip.file('index.html', '<!doctype html><html><head><link rel="stylesheet" href="assets/game.css"></head><body><img src="assets/icon.png"><script src="assets/game.js"></script></body></html>')
    zip.file('assets/game.css', 'body { background: url("icon.png"); }')
    zip.file('assets/game.js', 'document.body.dataset.ready = "yes"')
    zip.file('assets/icon.png', Buffer.from([ 137, 80, 78, 71 ]))

    try {
      const stored = await storeGameRuntimePackage({
        root,
        filename: 'game.zip',
        mimeType: 'application/zip',
        content: await zip.generateAsync({ type: 'nodebuffer' })
      })

      expect(stored.relativePath).to.match(/^[0-9a-f-]+\/index\.html$/)
      expect(stored.fileCount).to.equal(4)
      expect(stored.fileSizeBytes).to.be.greaterThan(0)
      expect((await readStoredGameRuntimeFile(root, stored.relativePath.replace(/\/index\.html$/, '/assets/game.js'))).toString())
        .to.contain('dataset.ready')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects zip packages without an entry, with external resources, unsafe paths, or dangerous files', async function () {
    const cases = [
      { name: 'missing entry', files: { 'assets/game.js': 'ok' }, message: 'root index.html' },
      { name: 'external resource', files: { 'index.html': '<script src="https://evil.test/game.js"></script>' }, message: 'External resources' },
      { name: 'unsafe path', files: { 'index.html': '<html></html>', '../secret.txt': 'nope' }, message: 'unsafe path' },
      { name: 'dangerous file', files: { 'index.html': '<html></html>', 'run.exe': 'nope' }, message: 'unsupported file type' }
    ]

    for (const testCase of cases) {
      const zip = new JSZip()
      for (const [ name, content ] of Object.entries(testCase.files)) zip.file(name, content)
      const root = await mkdtemp(join(tmpdir(), 'peertube-games-'))

      try {
        let error: Error | undefined
        try {
          await storeGameRuntimePackage({
            root,
            filename: `${testCase.name}.zip`,
            mimeType: 'application/zip',
            content: await zip.generateAsync({ type: 'nodebuffer' })
          })
        } catch (err) {
          error = err as Error
        }

        expect(error, testCase.name).to.be.instanceOf(Error)
        expect(error?.message, testCase.name).to.contain(testCase.message)
      } finally {
        await rm(root, { recursive: true, force: true })
      }
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
})
