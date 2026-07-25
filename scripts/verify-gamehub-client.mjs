#!/usr/bin/env node
/**
 * Structural regression checks for GameHub client delivery contracts.
 * Reads real shipped sources (not re-implemented stubs).
 *
 * Usage: node ./scripts/verify-gamehub-client.mjs
 * Exit 0 on success; non-zero with printed failures otherwise.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

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

// 4) Optional: if client dist is present, layout must match server contracts
const indexPath = join(root, 'client/dist/browser/en-US/index.html')
const assetsBanner = join(root, 'client/dist/browser/assets/images/gamehub-header-banner-10x1.png')
if (existsSync(join(root, 'client/dist/browser'))) {
  assert(existsSync(indexPath), `when dist exists, require ${indexPath}`)
  // banner may be optional in stripped builds, but if images dir exists expect it
  const imagesDir = join(root, 'client/dist/browser/assets/images')
  if (existsSync(imagesDir)) {
    assert(
      existsSync(assetsBanner) || existsSync(join(imagesDir, 'gamehub-header-banner.png')),
      'dist browser assets should include gamehub header banner'
    )
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
if (existsSync(join(root, 'client/dist/browser'))) {
  console.log(' - client dist layout present and checked')
}
