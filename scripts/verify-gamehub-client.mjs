#!/usr/bin/env node
/**
 * Structural + optional live SPA smoke checks for GameHub client contracts.
 *
 * Usage:
 *   node ./scripts/verify-gamehub-client.mjs
 *   GAMEHUB_VERIFY_BASE=http://127.0.0.1:9000 node ./scripts/verify-gamehub-client.mjs
 *
 * Exit 0 on success; non-zero with printed failures otherwise.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const locale = 'en-US'
const expectedBaseHref = `/client/${locale}/`

function read (rel) {
  const p = join(root, rel)
  if (!existsSync(p)) {
    failures.push(`missing file: ${rel}`)
    return ''
  }
  return readFileSync(p, 'utf8')
}

function assert (cond, msg) {
  if (!cond) failures.push(msg)
}

// 1) Banner absolute path in homepage template
const homeHtml = read('client/src/app/+games/games-home.component.html')
assert(
  homeHtml.includes('src="/client/assets/images/gamehub-header-banner-10x1.png"'),
  'games-home banner must use absolute /client/assets/... path'
)
assert(
  !/src=["']assets\/images\/gamehub-header-banner/.test(homeHtml),
  'games-home banner must not use relative assets/... path'
)

// 2) Server dist layout contracts
const clientCtrl = read('server/core/controllers/client.ts')
assert(
  /const distPath = join\(root\(\),\s*'client',\s*'dist',\s*'browser'\)/.test(clientCtrl),
  'client.ts must serve static files from client/dist/browser'
)

const pageHtml = read('server/core/lib/html/shared/page-html.ts')
assert(
  /join\(root\(\),\s*'client',\s*'dist',\s*'browser',\s*buildFileLocale\(lang\),\s*'index\.html'\)/.test(pageHtml),
  'page-html.ts must load index from client/dist/browser/<locale>/index.html'
)

// 3) High-priority feature presence (source + routes)
const routes = read('client/src/app/+games/routes.ts')
assert(routes.includes("path: 'watch-later'"), 'routes must register watch-later')
assert(routes.includes('GameWatchLaterComponent'), 'routes must use GameWatchLaterComponent')
assert(routes.includes("path: 'rankings'"), 'routes must register rankings')
assert(routes.includes('GameAuthorComponent'), 'routes must register author space')
assert(routes.includes('GamePlayComponent'), 'routes must register game play')

const watchLater = read('client/src/app/+games/watch-later.service.ts')
assert(watchLater.includes('class WatchLaterService') || watchLater.includes('export class WatchLaterService'), 'WatchLaterService must exist')

const recommend = read('client/src/app/+games/game-recommend.service.ts')
assert(
  recommend.includes('recommend') && (recommend.includes('recordView') || recommend.includes('record')),
  'GameRecommendService must expose recommend/recordView'
)

const rankings = read('client/src/app/+games/game-rankings.component.ts')
assert(rankings.includes("'updated'") || rankings.includes('"updated"'), 'rankings must include updated tab id')
assert(rankings.includes('最近更新'), 'rankings must label 最近更新')

const playHtml = read('client/src/app/+games/game-play.component.html')
assert(playHtml.includes('game-tags') || playHtml.includes('game-tag'), 'game-play must render tag cloud')
assert(
  playHtml.includes('watchLater') || playHtml.includes('toggleWatchLater') || playHtml.includes('稍后再玩'),
  'game-play must expose watch-later control'
)

const authorHtml = read('client/src/app/+games/game-author.component.html')
assert(authorHtml.includes('author-pinned') || authorHtml.includes('pinned-badge'), 'author page must show pinned works')

const homeTs = read('client/src/app/+games/games-home.component.ts')
assert(homeTs.includes('GameRecommendService') && homeTs.includes('personalized'), 'games-home must wire GameRecommendService personalization')
assert(homeHtml.includes('猜你喜欢'), 'games-home must render 猜你喜欢 section title')

// 4) Light-build scripts must force PeerTube base href (not "/")
const lightPs1 = read('scripts/build/client-light.ps1')
assert(
  lightPs1.includes("--base-href '/client/en-US/'") || lightPs1.includes('--base-href "/client/en-US/"') || lightPs1.includes("--base-href=/client/en-US/"),
  'client-light.ps1 must pass --base-href=/client/en-US/'
)
const clientSh = read('scripts/build/client.sh')
assert(
  /--base-href\s+["']\/client\/\$\{?defaultLanguage\}?\/["']|--base-href\s+["']\/client\/en-US\/["']/.test(clientSh) ||
    clientSh.includes('/client/$defaultLanguage/'),
  'client.sh light path must pass --base-href=/client/<locale>/'
)

// 5) Built index: base href + script resolution under /client/<locale>/
const indexPath = join(root, 'client/dist/browser', locale, 'index.html')
const assetsBanner = join(root, 'client/dist/browser/assets/images/gamehub-header-banner-10x1.png')
let resolvedScriptPaths = []

if (existsSync(join(root, 'client/dist/browser'))) {
  assert(existsSync(indexPath), `when dist exists, require ${indexPath}`)

  const indexHtml = readFileSync(indexPath, 'utf8')
  const baseMatch = indexHtml.match(/<base\s+href=["']([^"']+)["']/i)
  assert(!!baseMatch, 'built index.html must declare <base href>')
  if (baseMatch) {
    assert(
      baseMatch[1] === expectedBaseHref || baseMatch[1] === expectedBaseHref.slice(0, -1),
      `built index base href must be ${expectedBaseHref}, got ${baseMatch[1]}`
    )
  }

  const baseHref = baseMatch ? baseMatch[1] : expectedBaseHref
  const scriptSrcs = [ ...indexHtml.matchAll(/<script[^>]+src=["']([^"']+)["']/gi) ].map(m => m[1])
  assert(scriptSrcs.length > 0, 'built index.html must include script src tags')

  for (const src of scriptSrcs) {
    // Resolve relative to base href like a browser would for the SPA shell
    let absPath
    if (/^https?:\/\//i.test(src)) {
      absPath = new URL(src).pathname
    } else if (src.startsWith('/')) {
      absPath = src
    } else {
      const base = baseHref.endsWith('/') ? baseHref : `${baseHref}/`
      absPath = new URL(src, `http://local.invalid${base}`).pathname
    }

    assert(
      absPath.startsWith(`/client/${locale}/`) || absPath.startsWith('/client/assets/'),
      `SPA script must resolve under /client/${locale}/ or /client/assets/, got ${absPath} (from src=${src})`
    )

    // Map /client/* -> client/dist/browser/*
    const relUnderClient = absPath.replace(/^\/client\//, '')
    const diskPath = join(root, 'client/dist/browser', relUnderClient)
    assert(existsSync(diskPath), `resolved script must exist on disk: ${diskPath} (URL ${absPath})`)
    resolvedScriptPaths.push(absPath)
  }

  const imagesDir = join(root, 'client/dist/browser/assets/images')
  if (existsSync(imagesDir)) {
    assert(
      existsSync(assetsBanner) || existsSync(join(imagesDir, 'gamehub-header-banner.png')),
      'dist browser assets should include gamehub header banner'
    )
  }
}

// 6) Optional live HTTP: entry scripts must be application/javascript (not SPA HTML fallback)
const verifyBase = process.env.GAMEHUB_VERIFY_BASE
if (verifyBase) {
  const base = verifyBase.replace(/\/$/, '')
  const gamesUrl = `${base}/games`
  try {
    const gamesRes = await fetch(gamesUrl)
    assert(gamesRes.status !== 500, `GET /games must not be 500, got ${gamesRes.status}`)
    const liveHtml = await gamesRes.text()

    const liveBaseMatch = liveHtml.match(/<base\s+href=["']([^"']+)["']/i)
    assert(!!liveBaseMatch, 'served /games HTML must include <base href>')
    if (liveBaseMatch) {
      assert(
        liveBaseMatch[1] === expectedBaseHref || liveBaseMatch[1] === expectedBaseHref.slice(0, -1),
        `served /games base href must be ${expectedBaseHref}, got ${liveBaseMatch[1]}`
      )
    }

    const liveBase = liveBaseMatch ? liveBaseMatch[1] : expectedBaseHref
    const liveScripts = [ ...liveHtml.matchAll(/<script[^>]+src=["']([^"']+)["']/gi) ].map(m => m[1])
    assert(liveScripts.length > 0, 'served /games HTML must include script tags')

    for (const src of liveScripts) {
      let absUrl
      if (/^https?:\/\//i.test(src)) {
        absUrl = src
      } else if (src.startsWith('/')) {
        absUrl = `${base}${src}`
      } else {
        const b = liveBase.endsWith('/') ? liveBase : `${liveBase}/`
        absUrl = new URL(src, `${base}${b}`).href
      }

      const res = await fetch(absUrl, { method: 'GET' })
      const ct = (res.headers.get('content-type') || '').toLowerCase()
      assert(res.status === 200, `SPA script ${absUrl} must return 200, got ${res.status}`)
      assert(
        ct.includes('javascript') || ct.includes('ecmascript'),
        `SPA script ${absUrl} must be JS Content-Type, got ${ct || '(missing)'}`
      )
      // Extra guard: body must not look like the HTML shell
      const bodyStart = (await res.text()).slice(0, 64).toLowerCase()
      assert(
        !bodyStart.includes('<!doctype html') && !bodyStart.includes('<html'),
        `SPA script ${absUrl} body must not be HTML fallback`
      )
      console.log(`live script OK ${absUrl} CT=${ct}`)
    }

    // Banner still required on live path
    const bannerUrl = `${base}/client/assets/images/gamehub-header-banner-10x1.png`
    const bannerRes = await fetch(bannerUrl, { method: 'HEAD' })
    assert(bannerRes.status === 200, `banner HEAD must be 200, got ${bannerRes.status}`)
  } catch (err) {
    failures.push(`live verify against ${base} failed: ${err.message || err}`)
  }
}

if (failures.length) {
  console.error('verify-gamehub-client FAILED:')
  for (const f of failures) console.error(' -', f)
  process.exit(1)
}

console.log('verify-gamehub-client OK')
console.log(' - banner absolute path')
console.log(' - server dist/browser contracts')
console.log(' - high-priority feature sources/routes')
console.log(' - light build forces /client/en-US/ base href')
if (existsSync(join(root, 'client/dist/browser'))) {
  console.log(' - client dist layout + SPA script disk paths')
  for (const p of resolvedScriptPaths) console.log(`   script ${p}`)
}
if (verifyBase) {
  console.log(` - live SPA scripts under ${verifyBase} are application/javascript`)
}
