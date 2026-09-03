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
import { readFileSync, existsSync, readdirSync } from 'node:fs'
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

function readCssBlock (source, selector) {
  let selectorStart = source.indexOf(selector)
  while (selectorStart >= 0) {
    const selectorTail = source.slice(selectorStart + selector.length)
    if (/^\s*\{/.test(selectorTail)) {
      const blockStart = source.indexOf('{', selectorStart + selector.length)
      let depth = 0
      for (let index = blockStart; index < source.length; index++) {
        if (source[index] === '{') depth += 1
        if (source[index] !== '}') continue

        depth -= 1
        if (depth === 0) return source.slice(blockStart + 1, index)
      }

      return ''
    }

    selectorStart = source.indexOf(selector, selectorStart + selector.length)
  }

  return ''
}

function collectFiles (dir, suffix) {
  if (!existsSync(dir)) return []

  const result = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = join(dir, entry.name)
    if (entry.isDirectory()) result.push(...collectFiles(absolutePath, suffix))
    else if (entry.isFile() && entry.name.endsWith(suffix)) result.push(absolutePath)
  }
  return result
}

function assertBundleContract (body, label) {
  // The old compiled implementation lacked this normalization and emitted
  // invalid comma RGB slash-alpha CSS. Require the fix wherever the carousel
  // method is present instead of matching its valid template literal.
  if (body.includes('featuredCoverFade')) {
    assert(
      body.includes('replace(/,\\s*/g'),
      `${label} contains the old invalid comma RGB slash-alpha gradient implementation`
    )
  }
}

// 1) GameHub home and banner asset contracts
const homeHtml = read('client/src/app/+games/games-home.component.html')
const homeTs = read('client/src/app/+games/games-home.component.ts')
const homeConstantsTs = read('client/src/app/+games/games-home.constants.ts')
const gameSectionTs = read('client/src/app/+games/games-home/game-section.component.ts')
const submitHeaderTs = read('client/src/app/header/header.component.ts')
const submitHeaderHtml = read('client/src/app/header/header.component.html')
const submitHeaderScss = read('client/src/app/header/header.component.scss')
const gamesIndexTs = read('server/core/controllers/api/games/index.ts')
const gameMetaTagsTs = read('client/src/app/+games/services/game-meta-tags.ts')
const navigationTs = read('client/src/app/header/game-navigation.component.ts')
const navigationHtml = read('client/src/app/header/game-navigation.component.html')
const eventDetailTs = read('client/src/app/+games/game-event-detail.component.ts')
const collectionDetailTs = read('client/src/app/+games/game-collection-detail.component.ts')
const collectionsTs = read('client/src/app/+games/game-collections.component.ts')
const eventsTs = read('client/src/app/+games/game-events.component.ts')
const gameCollectionControllerTs = read('server/core/controllers/api/games/game-collection.ts')
const gameEventControllerTs = read('server/core/controllers/api/games/events.ts')
const gameCollectionModelTs = read('packages/models/src/games/game-collection.model.ts')
const gameEventModelTs = read('packages/models/src/games/game-event.model.ts')
const gamehubLogoSvg = read('client/src/assets/images/gamehub-logo.svg')
const gamehubFaviconSvg = read('client/src/assets/images/gamehub-favicon.svg')
const fallbackLogoSvg = read('client/src/assets/images/logo.svg')
const gamehubWordmarkSvg = read('client/src/assets/images/gamehub-wordmark.svg')
const serverConfigManagerTs = read('server/core/lib/server-config-manager.ts')
const indexHtml = read('client/src/index.html')
const menuHtml = read('client/src/app/menu/menu.component.html')
const cssVariablesScss = read('client/src/sass/include/_css-variables.scss')
const primengScss = read('client/src/sass/primeng.scss')
const coverGeneratorTs = read('client/src/app/+games/services/cover-generator.service.ts')
const captchaTs = read('server/core/lib/auth/captcha.ts')
const emailerTs = read('server/core/lib/emailer.ts')

// 1a) GameHub branding keeps the wordmark and favicon as two clear roles
const sharedGPath = 'M 426 220 C 408 137 338 76 256 76 C 156 76 76 156 76 256 C 76 356 156 436 256 436 C 356 436 426 356 426 256 L 300 256'
const gameBrandColor = '#00aeec'
const logoAssets = [ gamehubLogoSvg, gamehubFaviconSvg, fallbackLogoSvg ]

assert(
  /<img[^>]+class="game-brand-wordmark"[^>]+src="\/client\/assets\/images\/gamehub-wordmark\.svg"[^>]+alt="GameHub"/.test(submitHeaderHtml),
  'game Header must render the accessible GameHub wordmark asset'
)
assert(
  /<img[^>]+class="menu-brand-wordmark"[^>]+src="\/client\/assets\/images\/gamehub-wordmark\.svg"[^>]+alt="GameHub"/.test(menuHtml),
  'mobile menu must render the accessible GameHub wordmark asset'
)
assert(
  submitHeaderScss.includes('.game-brand-wordmark') &&
    !submitHeaderScss.includes('.game-brand-logo') &&
    submitHeaderScss.includes('flex-basis: 104px'),
  'game Header must size the horizontal wordmark and keep it visible at narrow widths'
)
assert(
  serverConfigManagerTs.includes("fileUrl: WEBSERVER.URL + '/client/assets/images/gamehub-favicon.svg'"),
  'server favicon fallback must use the shared SVG favicon'
)
assert(
  serverConfigManagerTs.includes("fileUrl: WEBSERVER.URL + '/client/assets/images/gamehub-logo.svg'"),
  'server square Header logo fallback must use the shared SVG G mark'
)
assert(
  serverConfigManagerTs.includes("fileUrl: WEBSERVER.URL + '/client/assets/images/gamehub-wordmark.svg'") &&
    serverConfigManagerTs.includes('width: 116') &&
    serverConfigManagerTs.includes('height: 28'),
  'server desktop Header logo fallback must use the horizontal wordmark dimensions'
)
assert(
  indexHtml.includes('/client/assets/images/gamehub-favicon.svg?v=gamehub-bilibili-blue-theme'),
  'index.html must point the browser tab to the versioned Bilibili blue G favicon'
)
assert(
  logoAssets.every(asset => !asset.includes('gamehub-rainbow') && asset.includes(`d="${sharedGPath}"`) && asset.includes(`stroke="${gameBrandColor}"`)),
  'gamehub-logo.svg, gamehub-favicon.svg, and logo.svg must contain the same flat Bilibili blue G path'
)
assert(
  gamehubWordmarkSvg.includes('<text') &&
    gamehubWordmarkSvg.includes('GameHub') &&
    gamehubWordmarkSvg.includes(`fill="${gameBrandColor}"`) &&
    !gamehubWordmarkSvg.includes('gradient'),
  'gamehub-wordmark.svg must contain a flat Bilibili blue GameHub wordmark'
)
assert(
  !/:host-context\(\.game-experience\) \.game-brand-wordmark\s*\{\s*display:\s*none/.test(submitHeaderScss),
  'game Header stylesheet must keep the full wordmark visible at narrow widths'
)
for (const asset of logoAssets) {
  assert(
    !asset.includes('stop-color=') && !asset.includes('linearGradient'),
    'shared square Logo assets must not contain rainbow gradient stops'
  )
}
const bannerAssetPath = join(root, 'client/src/assets/images/gamehub-header-banner-10x1.png')
assert(
  existsSync(bannerAssetPath),
  'GameHub header banner source asset must exist'
)

// 1b) Shared GameHub icon contract
const globalIconTs = read('client/src/app/shared/shared-icons/global-icon.component.ts')
const gameAvatarTs = read('client/src/app/shared/game-avatar.ts')
const tablerAssetFiles = collectFiles(join(root, 'client/src/assets/images/tabler'), '.svg')
for (const file of tablerAssetFiles) {
  const body = readFileSync(file, 'utf8').trim()
  const label = file.startsWith(root) ? file.slice(root.length + 1) : file
  assert(body.startsWith('<svg'), `${label} must start with an SVG root element`)
  assert(!body.includes('Exit code') && !body.includes('Wall time') && !body.includes('Output:'), `${label} must not contain shell output`)
}

// 2) Server dist layout contracts
const clientCtrl = read('server/core/controllers/client.ts')
assert(
  clientCtrl.includes("const distPath = join(root(), 'client', 'dist', 'browser')"),
  'client.ts must serve static files from client/dist/browser'
)

const pageHtml = read('server/core/lib/html/shared/page-html.ts')
const indexHtmlStart = pageHtml.indexOf('static async getIndexHTML')
const indexHtmlEnd = pageHtml.indexOf('static getIndexHTMLPath', indexHtmlStart)
const indexHtmlSection = pageHtml.slice(indexHtmlStart, indexHtmlEnd)
assert(
  pageHtml.includes("join(root(), 'client', 'dist', 'browser', fileLocale, 'index.html')") ||
    pageHtml.includes("join(root(), 'client', 'dist', 'browser', fallbackLocale, 'index.html')"),
  'page-html.ts must load index from client/dist/browser/<locale>/index.html'
)
assert(
  indexHtmlSection.includes('if (!isTestOrDevInstance() && this.htmlCache[path])'),
  'page-html.ts must not reuse stale index HTML in development'
)
assert(
  indexHtmlSection.includes('if (!isTestOrDevInstance()) this.htmlCache[path] = html'),
  'page-html.ts must only cache generated index HTML outside development'
)

// 3) High-priority feature presence (source + routes)
const routes = read('client/src/app/+games/routes.ts')
const gameLoginGuardTs = read('client/src/app/+games/game-login.guard.ts')
assert(routes.includes("path: 'watch-later'"), 'routes must register watch-later')
assert(routes.includes('GameWatchLaterComponent'), 'routes must use GameWatchLaterComponent')
assert(routes.includes("path: 'rankings'"), 'routes must register rankings')
assert(routes.includes('GameAuthorComponent'), 'routes must register author space')
assert(routes.includes('GamePlayComponent'), 'routes must register game play')
assert(
  routes.includes("path: 'upload'") && routes.includes('GameUploadComponent') &&
    gameLoginGuardTs.includes('loginModalService.open({ returnUrl: state.url })'),
  'game upload must stay registered behind a login guard that opens the login modal with the requested return URL preserved'
)
assert(
  submitHeaderHtml.includes('(click)="openGameUpload($event)"') &&
    !submitHeaderHtml.includes('routerLink="/games/upload"') &&
    submitHeaderTs.includes('openGameUpload (event: MouseEvent)') &&
    submitHeaderTs.includes('event.button !== 0') &&
    submitHeaderTs.includes("this.router.navigate([ '/games/upload' ])") &&
    submitHeaderTs.includes("authModal.openLogin({ returnUrl: '/games/upload' })") &&
    submitHeaderScss.includes(':host-context(.game-experience) .game-header-right') &&
    submitHeaderScss.includes('z-index: 2;'),
  'GameHub submit action must explicitly preserve the upload return URL and stay above centered navigation'
)
assert(
  !gameCollectionControllerTs.includes('gameCount: 0') &&
    gameCollectionControllerTs.includes('getPublishedGameCountByCollection') &&
    gameCollectionControllerTs.includes("where: { status: 'published' }") &&
    gameCollectionModelTs.includes('description: string | null') &&
    gameCollectionModelTs.includes('gameCount: number') &&
    gameCollectionModelTs.includes('data: Game[]') &&
    !gameCollectionModelTs.includes('itemCount: number') &&
    !gameCollectionModelTs.includes('games: Game[]') &&
    !collectionsTs.includes('as unknown as GameCollection[]') &&
    !collectionDetailTs.includes('as unknown as GameCollectionDetail'),
  'GameHub collections must expose exact published-game counts through the shared response contract'
)
assert(
  gameEventControllerTs.includes("gameEventRouter.get('/:slug/participation', authenticate") &&
    gameEventControllerTs.includes('getEventParticipation') &&
    gameEventControllerTs.includes('maxParticipants > 0 && event.participantCount >= event.maxParticipants') &&
    gameEventControllerTs.includes('transaction.LOCK.UPDATE') &&
    gameEventControllerTs.includes('participantCount') &&
    eventDetailTs.includes('getEventParticipation(slug)') &&
    !eventDetailTs.includes('checkJoined') &&
    !eventDetailTs.includes('result.data.some') &&
    gameEventModelTs.includes('export interface GameEventJoinResult') &&
    !eventsTs.includes('as unknown as GameEvent[]'),
  'GameHub events must return exact user participation, enforce capacity atomically, and share their response contracts'
)

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
assert(
  rankings.includes('{{ formatNumber(game.stats.comments) }} 评论') &&
    !rankings.includes('{{ formatNumber(game.stats.likes) }} 点赞') &&
    !rankings.includes('{{ formatNumber(game.stats.favorites) }} 收藏'),
  'ranking game items must use play and comment counts instead of the legacy like/favorite stats'
)

const playHtml = read('client/src/app/+games/game-play.component.html')
const playTsForControls = read('client/src/app/+games/game-play.component.ts')
const playRuntimeFrameScss = read('client/src/app/+games/game-play/_runtime-frame.scss')
const playResponsiveScss = read('client/src/app/+games/game-play/_responsive.scss')
assert(playHtml.includes('game-stage') && playHtml.includes('<iframe'), 'game-play must render the HTML game stage')
assert(playHtml.includes('developer-profile'), 'game-play developer card must group identity text and follow action for vertical centering')
assert(playHtml.includes('onRelatedCoverError'), 'game-play related covers must fall back when an image request fails')
const playerControlsLeft = playHtml.match(/<div class="game-player-controls-left">([\s\S]*?)<\/div>/)?.[1] || ''
assert(
  playerControlsLeft.includes('aria-label="重新加载"') &&
    !playerControlsLeft.includes('aria-label="开始游戏"') &&
    !playerControlsLeft.includes('准备就绪') &&
    !playerControlsLeft.includes('正在游玩') &&
    playHtml.includes('<div class="game-player-controls-right">') &&
    playHtml.includes('调整游戏音量') &&
    playHtml.includes('aria-label="全屏试玩"') &&
    !playHtml.includes('start-game-overlay') &&
    !playTsForControls.includes('gameStarted') &&
    !playTsForControls.includes('startGame') &&
    !playRuntimeFrameScss.includes('start-game-overlay'),
  'game-play controls must omit the start overlay, keep reload on the left, and keep volume/fullscreen on the right'
)
assert(
  playRuntimeFrameScss.includes('aspect-ratio: 16 / 9;') &&
    playRuntimeFrameScss.includes('height: auto;') &&
    !playRuntimeFrameScss.includes('height: var(--game-stage-height);') &&
    !playResponsiveScss.includes('.game-play-page .game-stage { height: clamp') &&
    !playResponsiveScss.includes('.game-play-page .game-stage { height: 320px;'),
  'game-play stage height must be derived from its width with a 16:9 aspect ratio'
)
const reservationsTs = read('client/src/app/+games/game-reservations.component.ts')
assert(
  reservationsTs.includes('iconName="message-circle"') && reservationsTs.includes('{{ item.game.comments || 0 }} 评论') &&
    !reservationsTs.includes('iconName="like"') && !reservationsTs.includes('{{ item.game.likes || 0 }} 点赞'),
  'game reservations must use play and comment metrics instead of the legacy like metric'
)
const gameOverviewCtrl = read('server/core/controllers/api/games/community-overview.ts')
const gameCrudQueryTs = read('server/core/controllers/api/games/game-crud-query.ts')
const openapi = read('support/doc/api/openapi.yaml')
assert(
  !gameCrudQueryTs.includes("/:uuid/download") && !gameCrudQueryTs.includes('downloadGame') &&
    !openapi.includes('/api/v1/games/{uuid}/download'),
  'GameHub must not expose a game download API route or OpenAPI contract'
)
assert(
  gameOverviewCtrl.includes('coverFallback: null'),
  'related games must not advertise a cover fallback URL when the game has no cover'
)

const authorHtml = read('client/src/app/+games/game-author.component.html')
const authorScss = read('client/src/app/+games/game-author.component.scss')
const authorModel = read('packages/models/src/games/game-author.model.ts')
const authorController = read('server/core/controllers/api/games/personal-author.ts')
const authorGamesServiceTs = read('client/src/app/+games/games.service.ts')
const authorCreatorServiceTs = read('client/src/app/+games/services/game-creator.service.ts')
assert(
  authorHtml.includes('class="author-hero"') &&
    authorHtml.includes('class="author-hero-banner"') &&
    authorHtml.includes('class="author-navigation-row"') &&
    authorHtml.includes('class="author-home-tab"') &&
    authorHtml.includes('class="author-stats-bar"') &&
    authorHtml.includes('关注数') &&
    authorHtml.includes('粉丝数') &&
    authorHtml.includes('获赞数') &&
    authorHtml.includes('游玩数') &&
    authorHtml.includes('author()!.account.followingCount') &&
    authorHtml.includes('author()!.account.followers') &&
    authorHtml.includes('author()!.stats.likes') &&
    authorHtml.includes('author()!.stats.plays') &&
    authorHtml.includes('class="author-main"') &&
    authorHtml.includes('@for (game of author()!.data') &&
    /<div class="author-filter-row"[^>]*>\s*<span class="author-game-count">\{\{ author\(\)!\.stats\.games \}\} 个作品<\/span>[\s\S]*最新发布[\s\S]*最多游玩[\s\S]*最多收藏[\s\S]*<\/div>/.test(authorHtml) &&
    !authorHtml.includes('这里展示 {{ author()!.account.displayName }} 开发的全部网页小游戏。') &&
    !authorHtml.includes('作者主页') &&
    !authorHtml.includes('全部游戏') &&
    !authorHtml.includes('class="author-section-heading"') &&
    !authorHtml.includes('class="author-tabs"') &&
    !authorHtml.includes('selectTab(') &&
    !authorHtml.includes('author-activity-panel') &&
    !authorHtml.includes('author-collections') &&
    !authorHtml.includes('class="author-sidebar"') &&
    !authorHtml.includes('class="author-pinned"'),
  'author page must expose a single homepage with real statistics, sorting, and the complete game grid without removed panels'
)
assert(
  authorScss.includes('.author-hero') &&
    authorScss.includes('.author-hero-banner') &&
    authorScss.includes('.author-navigation-row') &&
    authorScss.includes('.author-home-tab') &&
    authorScss.includes('.author-game-count') &&
    /\.author-filter-row\s*\{[\s\S]*?overflow-x: auto;/.test(authorScss) &&
    !authorScss.includes('.author-section-heading') &&
    !authorScss.includes('.author-section-kicker') &&
    authorScss.includes('grid-template-columns: repeat(5, minmax(0, 1fr));') &&
    authorScss.includes('@media (max-width: 640px)') &&
    !authorScss.includes('grid-template-columns: minmax(0, 1fr) 240px;') &&
    !authorScss.includes('.author-sidebar') &&
    !authorScss.includes('.author-pinned'),
  'author page must define the responsive hero and full-width five-column game grid'
)
assert(
  authorModel.includes('followingCount: number') &&
    authorController.includes('followingCount: account.Actor.followingCount || 0'),
  'author API must expose the real following count for the creator statistics row'
)
const authorTs = read('client/src/app/+games/game-author.component.ts')
assert(
  authorTs.includes('readonly gridLoading = signal(false)') &&
    authorTs.includes('private refreshWorks (accountId: string)') &&
    /const isSameAuthor = this\.currentAccountId === accountId && this\.author\(\) !== null/.test(authorTs) &&
    authorTs.includes('this.authorState.data.update(value => value ? { ...value, data: result.data } : result)') &&
    authorHtml.includes('[class.grid-refreshing]="gridLoading()"') &&
    authorScss.includes('.author-main .game-grid.grid-refreshing'),
  'author sort switching must patch only the works grid in place so the page never falls back to the full skeleton'
)
assert(
  authorGamesServiceTs.includes('authorStatsVersion=2') && authorCreatorServiceTs.includes('authorStatsVersion=2'),
  'author data requests must version the response shape so browsers do not reuse the pre-statistics cache entry'
)
assert(!authorHtml.includes('account.handle'), 'author page must not render an account handle in the visible profile')
assert(
  !authorHtml.includes('author-tab-panel') &&
    !authorHtml.includes('author-collection') &&
    !authorHtml.includes('pinned-card') &&
    !authorHtml.includes('author-side-card'),
  'author home must not keep activity, collection, pinned, or sidebar-only markup'
)

assert(homeTs.includes('GameRecommendService') && homeTs.includes('recommendService'), 'games-home must wire GameRecommendService personalization')
assert(
  homeTs.includes('const pageSize = 8') &&
    homeTs.includes('const lastPageStart = Math.max(total - pageSize, 0)') &&
    homeTs.includes('Math.min(this.recommendedOffset() + pageSize, lastPageStart)'),
  'recommended shuffle must wrap to a full final page instead of leaving the carousel with fewer than six items'
)
assert(homeHtml.includes('my-featured-carousel'), 'games-home must render the featured carousel')
assert(homeHtml.includes('我玩过的') && homeHtml.includes('最新发布') && homeHtml.includes('热门游戏'), 'games-home must render the required feed sections')
assert(
  gameMetaTagsTs.includes("titleService.setTitle('GameHub')") && !gameMetaTagsTs.includes('titleService.setTitle(title)'),
  'browser tab title must remain GameHub while game title stays in share metadata'
)
assert(
  /latest:\s*this\.gamesService\.list\(\{ \.\.\.common, count: 5, sort: 'latest' \}\)\.pipe\(\s*catchError\(\(\) => of\(\{ total: 0, data: \[\] as Game\[\] \}\)\)/.test(homeTs) &&
    /popular:\s*this\.gamesService\.list\(\{ \.\.\.common, count: 10, sort: 'popular' \}\)\.pipe\(\s*catchError\(\(\) => of\(\{ total: 0, data: \[\] as Game\[\] \}\)\)/.test(homeTs),
  'games-home must isolate optional latest and popular feed failures'
)
assert(
  gameSectionTs.includes('@if (games().length)') &&
    gameSectionTs.includes('@if (shuffleLabel() && games().length)') &&
    gameSectionTs.includes('{{ shuffleLabel() }}') &&
    !gameSectionTs.includes('; as label'),
  'empty game sections must not render headings or shuffle actions'
)
const staticGameRouterRegistrations = gamesIndexTs.match(/gamesRouter\.use\('\/', (discoveryRouter|personalRouter|reservationRouter|collectionRouter)\)/g) || []
assert(staticGameRouterRegistrations.length === 4, 'games static namespace routers must be registered exactly once')
assert(
  !homeHtml.includes('返回发现') && !homeHtml.includes('该分类暂无游戏') && !homeHtml.includes('浏览全部'),
  'games-home must keep category-empty pages visually blank and remove return navigation actions'
)
assert(!homeHtml.includes('sort-pills') && !homeTs.includes('sortKinds') && !homeConstantsTs.includes("id: 'likes'") && !homeConstantsTs.includes("id: 'coins'"), 'games-home must not expose legacy video sorting pills')
assert(
  homeTs.includes("const validSorts = [ 'recommended', 'latest', 'popular' ]") &&
    !homeTs.includes('最多点赞') && !homeTs.includes('最多投币') && !homeTs.includes('最多收藏'),
  'games-home must only accept the current discovery sorts'
)
assert(
  homeTs.includes('private requestGeneration = 0') &&
    homeTs.includes('const generation = ++this.requestGeneration') &&
    homeTs.includes('const generation = this.requestGeneration') &&
    homeTs.includes('private isCurrentRequest (generation: number)') &&
    (homeTs.match(/if \(!this\.isCurrentRequest\(generation\)\) return/g) || []).length >= 5,
  'games-home must ignore stale feed responses after query or sort changes'
)
assert(!navigationTs.includes('双人游戏') && !navigationTs.includes('多人联机'), 'search hot keywords must not reintroduce multiplayer-only labels')
assert(
  navigationHtml.includes('@if (history().length && !suggestionLoading() && !suggestions().length) {') &&
    !navigationHtml.includes('@if (history().length && !suggestionLoading() && !query().trim()) {'),
  'search focus must keep recent search history visible when the previous query is prefilled'
)
assert(
  navigationHtml.includes('aria-label="搜索游戏、作者或标签"'),
  'game search input must expose its accessible name directly to assistive technology'
)
assert(
  navigationTs.includes('private suggestionGeneration = 0') &&
    navigationTs.includes('clearTimeout(this.suggestionTimer)') &&
    navigationTs.includes('const generation = ++this.suggestionGeneration') &&
    navigationTs.includes('this.fetchSuggestions(trimmed, generation)') &&
    navigationTs.includes('this.suggestionVisible.set(result.data.length > 0)') &&
    (navigationTs.match(/if \(generation !== this\.suggestionGeneration\) return/g) || []).length >= 2,
  'search suggestions must ignore stale query responses and clear delayed work when the navigation is destroyed'
)
assert(
  /if \(event\.key === 'Escape'\) \{[\s\S]{0,180}event\.preventDefault\(\)[\s\S]{0,180}this\.focused\.set\(false\)/.test(navigationTs),
  'game search must close its open suggestion panel when Escape is pressed'
)
assert(!eventDetailTs.includes('返回活动列表') && !collectionDetailTs.includes('浏览全部专题') && !collectionDetailTs.includes('返回专题列表'), 'game detail states must not render legacy return buttons')

const featuredTs = read('client/src/app/+games/games-home/featured-carousel.component.ts')
assert(
  !featuredTs.includes('FEATURED_PLACEHOLDER_AVG_RGB') &&
    !featuredTs.includes('featuredAvgColors') &&
    !featuredTs.includes('averageRgb') &&
    !featuredTs.includes('onFeaturedImageLoad'),
  'featured carousel must keep real covers without sampling or generating page colors'
)
const featuredHtml = read('client/src/app/+games/games-home/featured-carousel.component.html')
const featuredScss = read('client/src/app/+games/games-home/featured-carousel.component.scss')
assert(
  !featuredHtml.includes('featuredCoverFade') &&
    !featuredHtml.includes('onFeaturedImageLoad') &&
    !featuredScss.includes('linear-gradient') &&
    featuredScss.includes('grid-template-columns: minmax(0, 2fr) repeat(3, minmax(0, 1fr));') &&
    featuredScss.includes('grid-column: 1;') &&
    featuredScss.includes('grid-column: 2 / -1;') &&
    featuredScss.includes('grid-template-columns: repeat(3, minmax(0, 1fr));'),
  'featured carousel must use a fixed image-led lead and three-column media rail'
)
assert(
  featuredHtml.includes("[attr.aria-current]=\"index === carouselIndex() ? 'true' : null\""),
  'featured carousel indicators must expose the active recommendation with aria-current'
)
const gameCardHtml = read('client/src/app/+games/game-card.component.html')
const gameCardScss = read('client/src/app/+games/game-card.component.scss')
const gameCardTs = read('client/src/app/+games/game-card.component.ts')
const gameRankingsTs = read('client/src/app/+games/game-rankings.component.ts')
const notificationHtml = read('client/src/app/+games/game-notifications.component.html')
assert(
  gameCardHtml.includes('[innerHTML]="game().title | highlight: searchTerm()"') &&
    !gameCardHtml.includes('{{ searchTerm ? (game.title | highlight: searchTerm) : game.title }}'),
  'game card search highlights must render sanitized mark HTML instead of exposing markup text'
)
assert(
  gameCardHtml.includes('<article class="game-card">') &&
    gameCardHtml.includes('<a class="game-card-main"') &&
    gameCardHtml.includes('<div class="game-card-author">') &&
    !/<a class="game-card"[\s\S]*<a class="author-name-link"/.test(gameCardHtml),
  'game cards must keep the author link outside the main game link to avoid nested interactive elements'
)
assert(
  gameCardScss.includes('.game-card:hover') &&
    gameCardScss.includes('transform: translateY(-2px);') &&
    /\.game-card:hover \.game-cover img,[\s\S]*?transform: scale\(1\.045\);/.test(gameCardScss) &&
    gameCardScss.includes('@media (prefers-reduced-motion: reduce)'),
  'game cards must lift on hover with a cover zoom and respect reduced motion'
)
assert(!gameCardScss.includes('transform: scale(1.035)'), 'game card covers must keep the unified 1.05 hover zoom')
const coverToneTs = read('client/src/app/+games/cover-tone.ts')
const coverToneTokens = read('client/src/app/+games/game-community.tokens.scss')
assert(
  !coverToneTokens.includes('.cover-tone-') &&
    !coverToneTs.includes('export function coverToneClass') &&
    coverToneTs.includes('export function coverInitial') &&
    gameCardHtml.includes('class="game-card">') &&
    gameCardHtml.includes('class="game-cover-placeholder-art"') &&
    gameCardHtml.includes('class="game-cover-meta"') &&
    gameCardHtml.includes('game-card-category') &&
    gameCardHtml.includes('class="game-card-meta-line"') &&
    gameCardScss.includes('background: var(--game-cover-fallback-deep);') &&
    gameCardScss.includes('background-image: url(\'/client/assets/images/gamehub-header-banner.png\');') &&
    !gameCardScss.includes('linear-gradient') &&
    gameCardScss.includes('-webkit-line-clamp: 2;') &&
    gameCardScss.includes('.game-card:hover h3') &&
    gameCardScss.includes('color: var(--game-brand-deep);') &&
    !gameCardHtml.includes('cover-placeholder-copy') &&
    !gameCardScss.includes('.cover-letter'),
  'game cards must render scenic placeholders with media stats, body category and two-line titles'
)
assert(
  !featuredHtml.includes('coverToneClass(featuredGame)') &&
    featuredHtml.includes('game-featured-placeholder-art') &&
    featuredScss.includes('background: var(--game-cover-fallback-deep);') &&
    featuredScss.includes('background-image: url(\'/client/assets/images/gamehub-header-banner.png\');') &&
    !featuredScss.includes('linear-gradient'),
  'featured carousel placeholders must share the scenic media surface'
)
assert(
  notificationHtml.includes('class="notification-item"') &&
    notificationHtml.includes('(click)="markRead(notification)"') &&
    /<article class="notification-item"[^>]*tabindex="0"[^>]*role="button"[^>]*\(keyup\.enter\)="markRead\(notification\)"/.test(notificationHtml),
  'notification rows must stay keyboard accessible (tabindex + button role + enter key) while keeping their inner links and delete button'
)
const gamePlayHtml = read('client/src/app/+games/game-play.component.html')
const gamePlayTs = read('client/src/app/+games/game-play.component.ts')
const gamePlayScss = [
  'client/src/app/+games/game-play.component.scss',
  'client/src/app/+games/game-community.tokens.scss',
  'client/src/app/+games/game-play/_layout.scss',
  'client/src/app/+games/game-play/_runtime-frame.scss',
  'client/src/app/+games/game-play/_game-info.scss',
  'client/src/app/+games/game-play/_author-card.scss',
  'client/src/app/+games/game-play/_related.scss',
  'client/src/app/+games/game-play/_responsive.scss'
].map(read).join('\n')
const gamePlayLayoutScss = read('client/src/app/+games/game-play/_layout.scss')
const gamePlayRuntimeScss = read('client/src/app/+games/game-play/_runtime-frame.scss')
const gamePlayInfoScss = read('client/src/app/+games/game-play/_game-info.scss')
const discussTs = [
  'client/src/app/+games/game-discuss.component.ts',
  'client/src/app/+games/game-discuss.component.scss'
].map(read).join('\n')
const discussStoreTs = read('client/src/app/+games/game-discuss-store.ts')
const gameCommunityServiceTs = read('client/src/app/+games/services/game-community.service.ts')
const communityPanelTs = [
  'client/src/app/+games/game-community-panel.component.ts',
  'client/src/app/+games/game-community-panel.component.scss'
].map(read).join('\n')
const communityPanelScss = read('client/src/app/+games/game-community-panel.component.scss')
const gameCommunityTokens = read('client/src/app/+games/game-community.tokens.scss')
const commentsTs = [
  'client/src/app/+games/game-comments.component.ts',
  'client/src/app/+games/game-comments.component.scss'
].map(read).join('\n')
const commentsStoreTs = read('client/src/app/+games/game-comments-store.ts')
const commentsStoreImplementation = commentsStoreTs.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
const headerTs = read('client/src/app/header/header.component.ts')
const headerHtml = read('client/src/app/header/header.component.html')
const gameNavigationTs = read('client/src/app/header/game-navigation.component.ts')
const asyncStateTs = read('client/src/app/+games/shared/async-state.ts')
const activityFeedTs = read('client/src/app/+games/game-activity-feed.component.ts')
const headerScss = read('client/src/app/header/header.component.scss').replace(/\r\n/g, '\n')
const gameNavigationScss = read('client/src/app/header/game-navigation.component.scss')
const appScss = read('client/src/app/app.component.scss')
const gamesHomeScss = [
  'client/src/app/+games/games-home.component.scss',
  'client/src/app/+games/game-community.tokens.scss',
  'client/src/app/+games/games-home/_layout.scss',
  'client/src/app/+games/games-home/_empty-states.scss',
  'client/src/app/+games/games-home/_discovery-nav.scss',
  'client/src/app/+games/games-home/_sections.scss',
  'client/src/app/+games/games-home/_responsive.scss'
].map(read).join('\n')
const gamesHomeDiscoveryNavScss = read('client/src/app/+games/games-home/_discovery-nav.scss')
const gameFollowingTs = read('client/src/app/+games/game-following.component.ts')
assert(
  (homeHtml.match(/class="game-category-rail"/g) || []).length === 2 &&
    (homeHtml.match(/class="game-category-rail-grid"/g) || []).length === 2,
  'home category rails must render in both populated and empty states'
)
assert(
  homeHtml.includes('class="game-home-banner"') &&
    homeHtml.includes('class="game-category-rail"') &&
    homeHtml.includes('class="game-category-rail-grid"') &&
    homeHtml.includes('class="game-category-quick-links"') &&
    gamesHomeDiscoveryNavScss.includes('.game-category-rail') &&
    gamesHomeDiscoveryNavScss.includes('.game-category-rail-grid') &&
    gamesHomeDiscoveryNavScss.includes('overflow-x: auto;'),
  'games discovery navigation must use a grouped category rail with an overflow fallback'
)
assert(
  gamesHomeDiscoveryNavScss.includes('background: var(--game-surface-alt);') &&
    gamesHomeDiscoveryNavScss.includes('min-height: 44px;') &&
    !gamesHomeDiscoveryNavScss.includes('linear-gradient') &&
    gamesHomeDiscoveryNavScss.includes('color: var(--game-brand-deep);'),
  'discovery navigation must use quiet neutral chips with a clear active state'
)
assert(
  gameCommunityTokens.includes('--game-hot: #fb7299') &&
    gameCommunityTokens.includes('--game-media-overlay: rgb(24 25 28 / 72%)') &&
    gameCommunityTokens.includes('--game-banner-height:'),
  'GameHub tokens must define the restrained hot accent, media overlay, and home banner height'
)
const featuredScss2 = read('client/src/app/+games/games-home/featured-carousel.component.scss')
assert(
  featuredHtml.includes('class="game-section-heading featured-heading"') &&
    featuredHtml.includes('class="featured-shuffle"') &&
    featuredHtml.includes('@for (slide of [carouselIndex()]; track $index)') &&
    featuredScss2.includes('animation: featuredSlideIn 260ms var(--game-ease);') &&
    featuredScss2.includes('@keyframes featuredSlideIn') &&
    !featuredHtml.includes('section-side-action') &&
    !featuredScss2.includes('.section-side-action'),
  'featured section must expose its shuffle as a heading-row pill and fade slides in instead of the old floating side rail'
)
assert(
  gamesHomeScss.includes('grid-template-columns: repeat(5, minmax(0, 1fr));') &&
    !gamesHomeScss.includes('grid-template-columns: repeat(4, minmax(0, 1fr));'),
  'desktop game grids must keep five columns across supported desktop widths'
)
assert(
  headerScss.includes('@media (prefers-reduced-motion: reduce)') &&
    featuredScss.includes('@media (prefers-reduced-motion: reduce)') &&
    gameSectionTs.includes('@media (prefers-reduced-motion: reduce)') &&
    gamesHomeScss.includes('@media (prefers-reduced-motion: reduce)'),
  'GameHub hover and carousel motion must respect prefers-reduced-motion'
)
assert(
  /\.game-navigation-search\s*\{[\s\S]{0,500}background:\s*transparent;[\s\S]{0,500}border:\s*0;/.test(gameNavigationScss) &&
    /\.game-navigation-search input\s*\{[\s\S]{0,500}border:\s*1px solid var\(--game-border\);[\s\S]{0,500}background:\s*var\(--game-surface\);/.test(gameNavigationScss) &&
    /\.game-navigation-search input:focus-visible\s*\{[\s\S]{0,300}border-color:\s*var\(--game-brand\)(?:\s*!important)?;[\s\S]{0,300}box-shadow:\s*var\(--game-focus-ring\)(?:\s*!important)?;/.test(gameNavigationScss) &&
    !gameNavigationScss.includes('.game-navigation-search:focus-within'),
  'game search must keep one input border and one input-owned focus ring'
)
assert(
  gameNavigationScss.includes('background: var(--game-search-surface);'),
  'game search must use the shared content-platform field surface'
)
assert(
  gameCardHtml.includes('class="game-cover-placeholder-art"') && gameCardHtml.includes('class="game-cover-meta"'),
  'game card fallbacks must expose scenic media art and overlaid metadata'
)
assert(
  featuredHtml.includes('featured-cover-copy') &&
    featuredHtml.includes('game-featured-placeholder-art') &&
    /\.featured-side-grid\s*\{[\s\S]{0,900}grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/.test(featuredScss),
  'featured discovery must expose a readable in-cover hierarchy and three-column side rail'
)
assert(
  gameSectionTs.includes('grid-template-columns: repeat(5, minmax(0, 1fr));') &&
    !gameSectionTs.includes('grid-template-columns: repeat(4, minmax(0, 1fr));'),
  'shared home sections must keep five columns across supported desktop widths'
)
assert(
  gameSectionTs.includes('class="game-section-heading game-section-heading-row"') &&
    gameSectionTs.includes('class="section-shuffle"') &&
    gameSectionTs.includes('background: transparent;') &&
    gameSectionTs.includes('border-bottom: 2px solid transparent;') &&
    gameSectionTs.includes('min-height: 44px;') &&
    !gameSectionTs.includes('section-side-action') &&
    !gameSectionTs.includes('section-with-side-action') &&
    featuredScss.includes('.featured-heading') &&
    featuredScss.includes('@keyframes featuredSlideIn') &&
    !featuredScss.includes('section-side-action') &&
    !featuredScss.includes('section-with-side-action'),
  'shuffle actions must be heading-row pill buttons in shared and featured home sections (no floating side rail), and the featured slide must fade in'
)
assert(
  !homeHtml.includes('[shuffleLabel]="recent().length > 1 ? \'换一批\' : undefined"') &&
    !homeTs.includes('shuffleRecent ()'),
  'recently played games must keep the server-provided latest-first order without shuffle controls'
)
assert(
  /\.game-submit-button\s*\{[\s\S]*?font-weight: 700;[\s\S]*?\}/.test(headerScss),
  'GameHub submit navigation text must use bold weight for the primary CTA'
)
assert(
  headerHtml.includes('class="game-submit-button"') &&
    headerHtml.includes('href="/games/upload"') &&
    headerHtml.includes('(click)="openGameUpload($event)"') &&
    headerHtml.includes('[class.game-submit-button-active]="isGameUploadRoute()"') &&
    headerHtml.includes('title="投稿游戏"') &&
    headerHtml.includes('aria-label="投稿游戏"'),
  'GameHub submit navigation must keep a native upload fallback, explicit click routing, active state, and an accessible label'
)
assert(
  !gameFollowingTs.includes('following-handle') && !gameFollowingTs.includes('&#64;{{ author.handle }}'),
  'following author cards must not expose internal @handle text'
)
assert(
  homeConstantsTs.includes("id: 'racing', title: '竞速'") &&
    gameRankingsTs.includes("id: 'racing', label: '竞速'") &&
    gameCardTs.includes("racing: '竞速'"),
  'racing category must be available and labeled consistently across discovery, rankings, and cards'
)
const clearHistoryStart = gameNavigationTs.indexOf('clearHistory ()')
const clearHistoryEnd = gameNavigationTs.indexOf('\n  submitSearch', clearHistoryStart)
assert(
  clearHistoryStart >= 0 &&
    clearHistoryEnd > clearHistoryStart &&
    gameNavigationTs.slice(clearHistoryStart, clearHistoryEnd).includes("this.query.set('')"),
  'clearing search history must also clear the visible search query'
)
const gameCommunityOverviewTs = read('server/core/controllers/api/games/community-overview.ts')
const gameCommunityModelTs = read('packages/models/src/games/game-community.model.ts')
const gameStatsSummaryTs = read('server/core/models/game/game-stats-summary.ts')
const gameSharedTs = read('server/core/controllers/api/games/game-shared.ts')
const gameDiscoveryTs = read('server/core/controllers/api/games/game-discovery.ts')
const gameDiscoveryServiceTs = read('client/src/app/+games/services/game-discovery.service.ts')
const gameRankingModelTs = read('packages/models/src/games/game-ranking.model.ts')
const gameCreatorModelTs = read('packages/models/src/games/game-creator.model.ts')
const gameCreatorHtml = read('client/src/app/+games/game-creator.component.html')
const gameErrorRetryTs = read('client/src/app/+games/shared/game-error-retry.component.ts')
const gameEmptyStateTs = read('client/src/app/+games/shared/game-empty-state.component.ts')
const gameAnalyticsServerTs = read('server/core/lib/games/game-analytics.ts')
const personalCreatorTs = read('server/core/controllers/api/games/personal-creator.ts')
const gameFeedTs = read('server/core/lib/games/game-feed.ts')
const personalAuthorTs = read('server/core/controllers/api/games/personal-author.ts')
const personalLibraryTs = read('server/core/controllers/api/games/personal-library.ts')
const gameTestsTs = read('packages/tests/src/api/games/games-api.ts')
const gameAboutTs = read('client/src/app/game-about.component.ts')
const gameCommunityDoc = read('support/doc/development/game-community.md')
const gameCrudCreateTs = read('server/core/controllers/api/games/game-crud-create.ts')
const gameCrudUpdateTs = read('server/core/controllers/api/games/game-crud-update.ts')
const legacyGamePackageSpec = read('docs/superpowers/specs/2026-07-18-html-game-package-upload-design.md')
const legacyGamePackagePlan = read('docs/superpowers/plans/2026-07-18-html-game-package-upload-plan.md')
const gameRequirementsDoc = read('support/doc/development/gamehub-requirements-bilibili-benchmark.md')
const loginHtml = read('client/src/app/+login/login-modal.component.html')
const gameAccountHomeTs = read('client/src/app/game-account-home.component.ts')
const gameAccountSettingsTs = read('client/src/app/game-account-settings.component.ts')
const gameNotFoundTs = read('client/src/app/game-not-found.component.ts')
const gameCommunityRouterTs = read('server/core/controllers/api/games/community.ts')
const communityCommentsTs = read('server/core/controllers/api/games/community-comments.ts')
const gameDiscoveryServerTs = read('server/core/controllers/api/games/game-discovery.ts')
const databaseTs = read('server/core/initializers/database.ts')
const openapiTs = read('support/doc/api/openapi.yaml')
const gameShareControllerTs = read('server/core/controllers/api/games/game-share.ts')
const analyticsTs = read('client/src/app/+games/game-analytics-dashboard.component.ts')
const uploadHtml = read('client/src/app/+games/game-upload.component.html')
const uploadScss = read('client/src/app/+games/game-upload.component.scss')
const uploadTs = read('client/src/app/+games/game-upload.component.ts')
const gameRuntimeTs = read('server/core/controllers/api/games/runtime.ts')
const libraryHtml = read('client/src/app/+games/game-library.component.html')
const libraryTs = read('client/src/app/+games/game-library.component.ts')
const libraryScss = read('client/src/app/+games/game-library.component.scss')
const watchLaterScss = read('client/src/app/+games/game-watch-later.component.scss')
const creatorScss = read('client/src/app/+games/game-creator.component.scss')
const notificationsScss = read('client/src/app/+games/game-notifications.component.scss')
const gameAboutScss = read('client/src/app/game-about.component.scss')
const gameAccountHomeScss = read('client/src/app/game-account-home.component.scss')
const gameAccountSettingsScss = read('client/src/app/game-account-settings.component.scss')
const manageHtml = read('client/src/app/+games/game-manage.component.html')
const manageTs = read('client/src/app/+games/game-manage.component.ts')
const gamesServiceTs = read('client/src/app/+games/games.service.ts')
const clientPackageJson = JSON.parse(read('client/package.json'))
assert(
  gameCommunityTokens.includes('--game-font-size-page-title: clamp(1.625rem, 3vw, 2rem);') &&
    gameCommunityTokens.includes('--game-font-size-hero-title: clamp(1.75rem, 3.5vw, 2.4rem);') &&
    gameCommunityTokens.includes('.game-community-page :where(button, input, textarea, select) {') &&
    gameCommunityTokens.includes('.game-community-page :where(button) {') &&
    gameCommunityTokens.includes('.game-community-page :where(button, a, input, textarea, select):focus-visible {') &&
    gameCommunityTokens.includes('.game-community-page :where(a) {'),
  'GameHub generic controls must stay low-specificity so component-level typography and semantic colors cannot be overridden'
)
{
  const bodyTextScale = [
    '--game-font-size-xs: 0.75rem;',
    '--game-font-size-sm: 0.8rem;',
    '--game-font-size-md: 0.88rem;',
    '--game-font-size-lg: 1rem;'
  ]
  const gameStylesDir = 'client/src/app/+games'
  const gameStyleSources = readdirSync(gameStylesDir, { recursive: true })
    .filter(f => /\.(scss|ts)$/.test(String(f)))
    .map(f => read(`${gameStylesDir}/${String(f).replaceAll('\\', '/')}`))
  assert(
    bodyTextScale.every(t => gameCommunityTokens.includes(t)) &&
      [read('client/src/app/header/header.component.scss'), ...gameStyleSources, read('client/src/app/+login/login-modal.component.scss'), read('client/src/app/game-account-settings.component.scss')]
        .every(src => !/font-size:\s*0\.\d+rem/.test(src)),
    'GameHub body text must use the four-step font-size tokens (--game-font-size-xs/sm/md/lg); raw sub-1rem font-size literals are forbidden'
  )
}
assert(
  /\.library-page h1\s*\{[\s\S]*font-size: var\(--game-font-size-page-title\);/.test(libraryScss) &&
    /\.library-page h1\s*\{[\s\S]*font-size: var\(--game-font-size-page-title\);/.test(watchLaterScss) &&
    /\.notifications-header h1\s*\{[\s\S]*font-size: var\(--game-font-size-page-title\);/.test(notificationsScss) &&
    /\.creator-header h1\s*\{[\s\S]*font-size: var\(--game-font-size-page-title\);/.test(creatorScss) &&
    /\.game-account-header h1\s*\{[\s\S]*font-size: var\(--game-font-size-page-title\);/.test(gameAccountHomeScss) &&
    /\.game-settings-header h1\s*\{[\s\S]*font-size: var\(--game-font-size-page-title\);/.test(gameAccountSettingsScss) &&
    /\.author-profile h1\s*\{[\s\S]*font-size: var\(--game-font-size-hero-title\);/.test(read('client/src/app/+games/game-author.component.scss')),
  'GameHub inner-page and author-hero headings must use the shared readable type scale'
)
assert(
  /\.daily-login-btn\s*\{[\s\S]*color: var\(--game-brand-contrast\);/.test(creatorScss) &&
    /\.submit-button\s*\{[\s\S]*color: var\(--game-brand-contrast\);/.test(uploadScss) &&
    /\.back-to-top\s*\{[\s\S]*color: var\(--game-brand-contrast\);/.test(gamePlayLayoutScss) &&
    /\.game-settings-submit\s*\{[\s\S]*color: var\(--game-brand-contrast\);/.test(gameAccountSettingsScss) &&
    /\.game-about-primary\s*\{[\s\S]*color: var\(--game-brand-contrast\);/.test(gameAboutScss),
  'filled Bilibili brand controls must declare the high-contrast brand text token'
)
const relatedMarkupStart = gamePlayHtml.indexOf('class="related-game-list"')
const relatedMarkup = relatedMarkupStart >= 0 ? gamePlayHtml.slice(relatedMarkupStart, relatedMarkupStart + 1800) : ''
const relatedSchemaStart = openapiTs.indexOf('GameRelatedGame:')
const relatedSchemaEnd = openapiTs.indexOf('GameRelatedList:', relatedSchemaStart)
const relatedSchema = relatedSchemaStart >= 0 && relatedSchemaEnd > relatedSchemaStart
  ? openapiTs.slice(relatedSchemaStart, relatedSchemaEnd)
  : ''
assert(existsSync(join(root, 'server/core/models/game/game-chat-message.ts')), 'discussion chat must have an independent server model')
assert(existsSync(join(root, 'server/core/controllers/api/games/community-chat.ts')), 'discussion chat must have an independent API controller')
assert(discussTs.includes("GameDiscussStore"), 'discussion panel must use GameDiscussStore instead of the comment store')
assert(!discussTs.includes("GameCommentsStore"), 'discussion panel must not import the comment store')
assert(discussStoreTs.includes('discussion') && discussStoreTs.includes('send'), 'GameDiscussStore must load and send discussion messages')
assert(gameCommunityServiceTs.includes('discussion (') && gameCommunityServiceTs.includes('sendDiscussion'), 'community service must expose independent discussion endpoints')
assert(gamePlayHtml.includes('my-game-discuss'), 'game play must render the discussion group')
assert(
  !/\b(?:chatDraft|discussionDraft|submitChat|submitDiscussion|sendDiscussion|GameChatMessage|GameCommunityService|scrollDiscussToBottom|timeline)\b/.test(commentsStoreImplementation) &&
    commentsStoreImplementation.includes('submit (') && commentsStoreImplementation.includes('submitReply (') &&
    commentsStoreImplementation.includes('toggleLike ('),
  'comment store must keep review-only state and submission paths separate from discussion chat'
)
assert(
  relatedMarkup.includes('related-game-stat') && relatedMarkup.includes('iconName="play"') &&
    relatedMarkup.includes('iconName="message-circle"') && relatedMarkup.includes('item.comments') &&
    !relatedMarkup.includes('iconName="like"') && !relatedMarkup.includes('item.likes') &&
    !relatedMarkup.includes(' 游玩') && !relatedMarkup.includes(' 赞'),
  'related game stats must use compact play/comment icons without like stats or text labels'
)
assert(
  gameCommunityOverviewTs.includes('developerGames') &&
    gameCommunityOverviewTs.includes('relatedGames') &&
    gameCommunityModelTs.includes('developerGames: GameRelatedGame[]') &&
    gameCommunityModelTs.includes('relatedGames: GameRelatedGame[]'),
  'related game API must separate the developer games from same-category recommendations'
)
assert(
  gamePlayTs.includes('developerGames') &&
    gamePlayTs.includes('result.developerGames') &&
    gamePlayTs.includes('result.relatedGames') &&
    gamePlayHtml.includes('developer-games-section') &&
    gamePlayHtml.includes('same-category-section') &&
    gamePlayHtml.includes('开发者的其他游戏') &&
    gamePlayHtml.includes('同类型推荐'),
  'game detail sidebar must render developer games and same-category recommendations as separate sections'
)
assert(
  openapiTs.includes('developerGames:') &&
    openapiTs.includes('relatedGames:') &&
    relatedSchema.includes('comments:') &&
    !relatedSchema.includes('\n        likes:'),
  'related game OpenAPI schema must expose comments and both recommendation groups'
)
assert(
  gamePlayScss.includes('.related-game-stat my-global-icon') && gamePlayScss.includes('height: 0.72rem;') &&
    gamePlayScss.includes('width: 0.72rem;') && gamePlayScss.includes('stroke-width: 2;'),
  'related game stats must use a smaller centered icon box'
)
assert(/\.game-discuss-panel\s*\{\s*background: var\(--game-surface\);/.test(discussTs), 'discussion panel and its body must use the shared white surface token')
assert(discussTs.includes('wechat-time-separator') && discussStoreTs.includes('shouldShowTime'), 'discussion timestamps must group messages within ten minutes')
assert(
  discussTs.includes('[disabled]="!store.draft().trim() || store.submitting()"') &&
    /\.discuss-composer button:disabled\s*\{/.test(discussTs),
  'discussion send button must be disabled and gray for empty text or an in-flight request'
)
assert(
  /\.wechat-message\.own \.wechat-bubble\s*\{[\s\S]*background: var\(--game-brand-soft\);[\s\S]*color: var\(--game-brand-deep\);/.test(discussTs),
  'own discussion messages must use the shared brand-soft surface with brand ink text'
)
assert(discussTs.includes('maxlength="2000"') && !discussTs.includes('maxlength="5000"'), 'discussion input length must match the server 2000-character contract')
assert(
  commentsStoreTs.includes('private requestGeneration = 0') &&
    commentsStoreTs.includes('this.stopPolling()') &&
    commentsStoreTs.includes('if (!this.refreshTimer) this.refreshTimer = setInterval') &&
    commentsStoreTs.includes('if (generation !== this.requestGeneration || uuid !== this.uuid) return') &&
    /this\.sort\.set\(value\)\r?\n    const generation = \+\+this\.requestGeneration\r?\n    (?:this\.hasLoadedMore = false\r?\n    )?this\.loading\.set\(true\)\r?\n    this\.loadingMore\.set\(false\)/.test(commentsStoreTs),
  'comment polling and loads must stop and ignore stale route responses'
)
assert(
  discussStoreTs.includes('private requestGeneration = 0') &&
    discussStoreTs.includes('if (!this.refreshTimer) this.refreshTimer = setInterval') &&
    discussStoreTs.includes('if (generation !== this.requestGeneration || uuid !== this.uuid) return'),
  'discussion polling and loads must ignore stale route responses'
)
assert(
  commentsStoreTs.includes('private visibilityListening = false') &&
    discussStoreTs.includes('private visibilityListening = false') &&
    commentsStoreTs.includes('this.removeVisibilityListener()') &&
    discussStoreTs.includes('this.removeVisibilityListener()') &&
    !/private stopPolling \(\) \{[^}]*document\.removeEventListener\('visibilitychange', this\.onVisibilityChange\)/.test(commentsStoreTs) &&
    !/private stopPolling \(\) \{[^}]*document\.removeEventListener\('visibilitychange', this\.onVisibilityChange\)/.test(discussStoreTs),
  'comment and discussion polling must keep visibility listeners while paused so polling resumes after the tab becomes visible'
)
assert(
  communityCommentsTs.includes('commentCount') &&
    commentsStoreTs.includes('readonly commentCount = signal(0)') &&
    commentsStoreTs.includes('result.commentCount') &&
    commentsTs.includes('store.commentCount()') &&
    gamePlayTs.includes('commentsStore.commentCount()') &&
    gameCrudQueryTs.includes('includeStats') &&
    gameCrudQueryTs.includes('GameStatsSummaryModel'),
  'game comment totals must distinguish thread pagination from all comments and detail responses must include public stats'
)
assert(
  gameCrudQueryTs.includes('GameCommentModel.count') &&
    gameCrudQueryTs.includes('setDataValue(\'gameComments\'') &&
    gameSharedTs.includes('StatsSummary') &&
    gameSharedTs.includes('statsSummary?.[field]'),
  'game detail comments must use the live visible comment count and format included summary stats'
)
assert(
  gamePlayTs.includes('private loadGeneration = 0') &&
    (gamePlayTs.match(/if \(generation !== this\.loadGeneration \|\| this\.currentUuid !== uuid\) return/g) || []).length >= 3,
  'game detail requests must ignore stale responses after a route change'
)
assert(!communityPanelTs.includes('一键三连') && !communityPanelTs.includes('tripleAction'), 'community actions must not expose one-click triple interaction')
assert(
  communityPanelTs.includes("readonly actionLoading = signal<'rate' | 'favorite' | 'coin' | null>(null)") &&
    (communityPanelTs.match(/\[disabled\]="actionLoading\(\) !== null"/g) || []).length >= 3 &&
    communityPanelTs.includes('if (this.actionLoading() !== null) return') &&
    communityPanelTs.includes("this.actionLoading.set('rate')") &&
    communityPanelTs.includes("this.actionLoading.set('favorite')") &&
    communityPanelTs.includes("this.actionLoading.set('coin')") &&
    (communityPanelTs.match(/this\.actionLoading\.set\(null\)/g) || []).length >= 6,
  'game interaction buttons must share a request lock and always release it on success or failure'
)
assert(!communityPanelTs.includes('余额') && !communityPanelTs.includes('coin-row'), 'community actions must not expose a duplicate coin balance composer')
assert(
  communityPanelTs.includes('class="interaction-spacer"') &&
    communityPanelTs.includes('game-action-watch-later') &&
    communityPanelTs.includes('readonly watchLaterToggle = output()') &&
    communityPanelTs.includes('watchLaterToggle.emit()') &&
    !gamePlayHtml.includes('my-game-reserve-button') &&
    !gamePlayHtml.includes('game-secondary-actions'),
  'watch-later action must live at the right end of the like/coin interaction row instead of a separate reserve row'
)
assert(!communityPanelTs.includes('description-rating') && !communityPanelTs.includes('reviewScores'), 'game description must not expose star rating UI')
assert(!commentsTs.includes('评分') && !commentsTs.includes('review'), 'comments must be text-only and must not expose rating controls')
assert(!gamePlayHtml.includes('game-title-score'), 'game title must not expose a rating score')
assert(gamePlayHtml.includes('class="game-stage-row"'), 'game play must share a row between the game stage and discussion sidebar')
assert(gamePlayHtml.includes('game-title-developer'), 'developer information must stay in the title row above the discussion sidebar')
assert(!gamePlayHtml.includes('developer-title') && !/developer-name[\s\S]{0,200}game\(\)!\.title/.test(gamePlayHtml), 'developer card must not repeat the game title under the developer name')
assert(!gamePlayHtml.includes('author.handle'), 'developer card must not render the account handle')
assert(gamePlayHtml.includes('developer-owner-badge') && !gamePlayHtml.includes('[disabled]="community()!.isOwner"'), 'owner view must show an author badge instead of a disabled follow button')
assert(gamePlayScss.includes('.game-stage-row'), 'game play must define the aligned stage and discussion row')
assert(gamePlayScss.includes('.play-side my-game-discuss'), 'discussion sidebar must define its own stage-height region')
assert(gamePlayScss.includes('border: 0;') && gamePlayScss.includes('.developer-identity img'), 'developer avatar must render without a border')
assert(
  gamePlayScss.includes('grid-template-columns: 44px minmax(0, 1fr) auto;') &&
    /\.game-play-page \.game-title-developer \{[\s\S]*?justify-content: flex-end;[\s\S]*?width: auto;/.test(gamePlayScss) &&
    /\.game-play-page \.developer-identity img \{[\s\S]*?grid-column: 1;/.test(gamePlayScss) &&
    /\.game-play-page \.developer-profile \{[\s\S]*?grid-column: 2;/ .test(gamePlayScss) &&
    /\.game-play-page \.developer-follow-button \{[\s\S]*?grid-column: 3;/.test(gamePlayScss) &&
    gamePlayScss.includes('box-shadow: var(--game-detail-avatar-shadow);') &&
    gamePlayScss.includes('--game-detail-avatar-shadow:') &&
    gamePlayScss.includes('grid-template-columns: 40px minmax(0, 1fr) auto;'),
  'developer card must stay right-aligned with avatar, profile text, and follow button in one compact row'
)
assert(gamePlayScss.includes('--game-detail-gap: 16px'), 'game play must define the shared detail-page spacing rhythm')
assert(gamePlayScss.includes('--game-detail-columns: minmax(0, 4fr) minmax(240px, 1fr)'), 'game play must keep a shared 4:1 stage/sidebar layout')
assert(gamePlayScss.includes('aspect-ratio: 16 / 9'), 'game stage must use a stable 16:9 layout ratio')
assert(gamePlayScss.includes('box-sizing: border-box'), 'game detail layout must use border-box sizing for aligned dimensions')
assert(gamePlayHtml.includes('frameError()'), 'game-play must render an iframe-specific error state')
assert(gamePlayHtml.includes('重新连接'), 'game-play iframe error state must expose a reconnect action')
assert(!gamePlayHtml.includes('aria-live="polite"'), 'game-play controls must not add a text status beside the reload button')
assert(gamePlayHtml.includes('sandbox="allow-scripts allow-pointer-lock"') && !gamePlayHtml.includes('allow-fullscreen'), 'game-play iframe must keep a valid sandbox and use allow for fullscreen')
assert(gamePlayTs.includes('readonly frameError = signal(false)'), 'game-play must own an iframe-specific error signal')
assert(gamePlayTs.includes('this.frameError.set(false)'), 'game-play must clear the iframe error before retrying')
assert(gamePlayTs.includes('this.normalizeRuntimeUrl(url)'), 'game-play must normalize local runtime hosts for the active browser origin')
assert(gamePlayTs.includes('const localHosts = [ \'localhost\', \'127.0.0.1\', \'::1\' ]'), 'runtime host normalization must stay limited to loopback hosts')
assert(gamePlayTs.includes("window.location.hostname.replace(/^\\[|\\]$/g, '')"), 'runtime host normalization must support bracketed IPv6 loopback addresses')
assert(gamePlayTs.includes('private runtimeRequestUrl = \'\''), 'game-play must keep the raw runtime request URL for availability checks')
assert(gamePlayTs.includes('private runtimeProbeGeneration = 0'), 'game-play must track runtime probe generations')
assert(gamePlayTs.includes('private cancelRuntimeProbe ()'), 'game-play must cancel stale runtime probes')
assert(gamePlayTs.includes('private verifyFrameAvailability (requestUrl: string, generation: number)'), 'game-play must verify runtime availability with a generation token')
assert(gamePlayTs.includes('private isRuntimeProbeEligible (url: string)'), 'runtime availability checks must avoid assuming CORS on arbitrary origins')
assert(gamePlayTs.includes('if (!this.isRuntimeProbeEligible(requestUrl)) return'), 'runtime availability checks must skip non-CORS runtime origins')
assert(gamePlayTs.includes("this.http.head(requestUrl, { observe: 'response', withCredentials: false })"), 'runtime availability checks must use the signed URL without credentials')
assert(gamePlayTs.includes('generation !== this.runtimeProbeGeneration || requestUrl !== this.runtimeRequestUrl'), 'stale runtime probe responses must not change the current frame state')
assert(!gamePlayTs.includes('onFrameError () { this.frameLoading.set(false); this.loadingError.set(true) }'), 'iframe errors must not replace the whole game page')
assert(gamePlayLayoutScss.includes('--game-detail-surface'), 'game-play layout must define a detail surface token')
assert(gamePlayRuntimeScss.includes('.frame-error-card'), 'game runtime must style a local error card')
assert(gamePlayRuntimeScss.includes('prefers-reduced-motion'), 'game runtime motion must respect reduced-motion preferences')
assert(gamePlayInfoScss.includes('.game-title-meta'), 'game-play info styles must keep an explicit title contract')
assert(communityPanelScss.includes('.game-description-tab'), 'community panel must own its tab visual contract')
assert(communityPanelTs.includes('onDescriptionTabKeydown') && communityPanelTs.includes("event.key === 'ArrowLeft'") && communityPanelTs.includes("event.key === 'ArrowRight'"), 'game info tabs must support left/right keyboard navigation')
assert(communityPanelTs.includes('[attr.tabindex]'), 'game info tabs must use a roving tabindex')
assert(!playHtml.includes(' 游玩</span>') && !playHtml.includes(' 评论</span>'), 'game title metadata must keep the compact icon-number format')
assert(!communityPanelTs.includes('<small>点赞</small>') && !communityPanelTs.includes('<small>投币</small>'), 'game actions must not add a second text row under each icon')
assert(communityPanelTs.includes('align-items: center') && communityPanelTs.includes('height: 1.125rem') && communityPanelTs.includes('width: 1.125rem'), 'game action icons and numbers must share a compact centered baseline')
assert(communityPanelTs.includes('game-description-tabs') && communityPanelTs.includes('操作') && communityPanelTs.includes('game()?.instructions'), 'game description must expose separate overview and controls tabs')
assert(communityPanelTs.includes('border-top: 0;') && communityPanelTs.includes('margin-top: 0;'), 'game description must not add a duplicate divider above the content')
assert(discussTs.includes('min-height: 36px') && !discussTs.includes('实时交流'), 'discussion header must be compact and show only the discussion title')
assert(gamePlayScss.includes('background: var(--game-brand);') && gamePlayScss.includes('.developer-follow-button {') && gamePlayScss.includes('border-radius: var(--game-radius-pill);'), 'developer follow button must use the unified pill brand style')
assert(gameCommunityTokens.includes('--game-text: #18191c') && gameCommunityTokens.includes('--game-muted: #61666d'), 'game colors must keep the shared ink and muted text from the light token source')
assert(
  gameCommunityTokens.includes('--game-brand: #007ea7') &&
    gameCommunityTokens.includes('--game-brand-hover: #006b8d') &&
    gameCommunityTokens.includes('--game-brand-deep: #00566f') &&
    gameCommunityTokens.includes('--game-brand-vivid: #00aeec') &&
    gameCommunityTokens.includes('--game-accent: #007ea7') &&
    gameCommunityTokens.includes('--game-accent-hover: #006b8d'),
  'GameHub tokens must use the restrained content-platform blue palette'
)
assert(
  gameCommunityTokens.includes('--game-page-bg: #f6f7f8') &&
    gameCommunityTokens.includes('--game-surface-alt: #f1f2f3') &&
    gameCommunityTokens.includes('--game-text-primary: #18191c') &&
    gameCommunityTokens.includes('--game-border: #e3e5e7') &&
    gameCommunityTokens.includes('--game-brand-contrast: #ffffff'),
  'GameHub shared tokens must expose the content-platform canvas, ink, border and contrast values'
)
assert(
  /\.game-submit-button\s*\{[\s\S]{0,500}background:\s*var\(--game-brand\);/.test(headerScss) &&
    !/\.game-submit-button\s*\{[\s\S]{0,500}background:\s*var\(--game-accent\);/.test(headerScss),
  'GameHub submit CTA must be a teal primary action'
)
assert(
  cssVariablesScss.includes('--primary: var(--mainColor, #007ea7)') &&
    cssVariablesScss.includes('--primary: #007ea7') &&
    !cssVariablesScss.includes('--primary: #FF8F37') &&
    !cssVariablesScss.includes('--primary: #FD9C50'),
  'default light and dark global themes must use the restrained blue instead of the legacy orange palette'
)
assert(
  primengScss.includes('var(--game-success)') &&
    primengScss.includes('var(--game-danger)') &&
    primengScss.includes('var(--game-warning)') &&
    primengScss.includes('var(--game-info)') &&
    !primengScss.includes('#198754') &&
    !primengScss.includes('#dc3545') &&
    !primengScss.includes('#f1680d') &&
    !primengScss.includes('#03a9f4'),
  'PrimeNG toast accents must consume semantic GameHub tokens'
)
const automaticCoverStart = coverGeneratorTs.indexOf('async generateAutomaticCover')
const automaticCoverEnd = coverGeneratorTs.indexOf('  /** Composite a runtime screenshot', automaticCoverStart)
const automaticCoverSource = automaticCoverStart >= 0 && automaticCoverEnd > automaticCoverStart
  ? coverGeneratorTs.slice(automaticCoverStart, automaticCoverEnd)
  : ''
assert(
  !automaticCoverSource.includes('createLinearGradient') &&
    automaticCoverSource.includes("--game-cover-fallback") &&
    automaticCoverSource.includes("--game-brand") &&
    automaticCoverSource.includes("--game-text-primary") &&
    automaticCoverSource.includes("--game-text-secondary"),
  'automatic covers must use the flat light-skin surface and semantic text colors'
)
assert(
  captchaTs.includes("const CHAR_COLORS = [ '#007aa3', '#005a78', '#de5c83', '#109a76', '#92400e' ]") &&
    !captchaTs.includes("const CHAR_COLORS = [ '#00aeec'") &&
    !captchaTs.includes("'#fb7299'") &&
    !captchaTs.includes("'#dd8500'"),
  'captcha characters must use the readable deep brand and semantic color variants'
)
assert(
  emailerTs.includes("primary: '#00aeec'") &&
    emailerTs.includes("onPrimary: '#06222d'") &&
    emailerTs.includes("bg: '#071e28'") &&
    !emailerTs.includes("bg: '#140f0f'"),
  'email defaults must use the Bilibili-blue primary and a neutral blue-black dark background'
)
assert(gamePlayScss.includes('--game-text: var(--game-text-primary);') && gamePlayScss.includes('--game-muted: var(--game-text-secondary);'), 'detail page must alias the shared ink palette instead of redefining values')
assert(clientPackageJson.dependencies?.['@tabler/icons-angular'] || clientPackageJson.devDependencies?.['@tabler/icons-angular'], 'GameHub icons must use the Tabler Angular icon library')
assert(globalIconTs.includes('TablerIconComponent') && !globalIconTs.includes('assets/images/'), 'global icon wrapper must render the shared Tabler icon library instead of local SVG assets')
assert(
  homeHtml.includes('iconName="calendar"') &&
    homeHtml.includes('iconName="award"') &&
    homeHtml.includes('iconName="markdown"') &&
    homeHtml.includes('iconName="tag"') &&
    !/class="community-hub-icon">[^<]*[\u4e00-\u9fff]/u.test(homeHtml),
  'community hub cards must use shared library icons instead of text glyphs'
)
assert(globalIconTs.includes("'tag': IconTag"), 'shared icon library must expose the tag icon used by the community hub')
assert(gameAvatarTs.includes('shape-rendering="crispEdges"') && gameAvatarTs.includes('<rect') && !gameAvatarTs.includes('<text'), 'GameHub fallback avatars must use a circular pixel-art renderer instead of an initial letter')
assert(commentsTs.includes('iconName="mood-smile"') && !commentsTs.includes('>☺</button>'), 'comment composer must use a library smile icon instead of a text glyph')
assert(!analyticsTs.includes('🪙') && !analyticsTs.includes("'❤'") && analyticsTs.includes('iconName'), 'analytics controls must use shared library icons instead of emoji glyphs')
assert(
  analyticsTs.includes('this.gamesService.getAnalytics(this.currentRange())') &&
    gamesServiceTs.includes("getAnalytics (range: '7d' | '30d' | '90d' = '30d')") &&
    gamesServiceTs.includes('?range=${range}') &&
    personalCreatorTs.includes('req.query.range') &&
    gameAnalyticsServerTs.includes('play-trend:${accountId}:${days}') &&
    gameAnalyticsServerTs.includes('follower-trend:${accountId}:${days}'),
  'creator analytics time range must reach the API, queries, and range-specific caches'
)
assert(homeHtml.includes('iconName="search"') && !homeHtml.includes('🔍'), 'game home empty state must use the shared search icon instead of an emoji')
assert(
  gameCreatorHtml.includes('iconName="award"') && !gameCreatorHtml.includes('🎁'),
  'creator daily sign-in must use the shared icon library instead of an emoji glyph'
)
assert(
  gameErrorRetryTs.includes('GlobalIconComponent') && gameErrorRetryTs.includes('<my-global-icon') && !gameErrorRetryTs.includes("icon = '⚠'"),
  'game error state must use a shared library icon instead of an emoji glyph'
)
assert(
  gameEmptyStateTs.includes('GlobalIconComponent') && gameEmptyStateTs.includes('<my-global-icon') && !gameEmptyStateTs.includes("icon = '🎮'"),
  'game empty state must use a shared library icon instead of an emoji glyph'
)
assert(
  /\.wechat-bubble\s*\{[\s\S]*background: var\(--game-surface-alt\);[\s\S]*color: var\(--game-text-primary\);/.test(discussTs),
  'other discussion messages must use the shared secondary surface with ink text'
)
assert(
  /\.wechat-message\.own \.wechat-bubble\s*\{[\s\S]*background: var\(--game-brand-soft\);[\s\S]*color: var\(--game-brand-deep\);/.test(discussTs),
  'own discussion messages must use the shared brand-soft surface with brand ink text'
)
assert(
  gamePlayScss.includes('width: min(calc(100% - (var(--game-space-page) * 2)), var(--game-content-width));') &&
    !gamePlayScss.includes('max-width: 1280px;'),
  'detail page must use the shared page spacing and content-width tokens'
)
assert(/\.game-play-page \.game-title-developer\s*\{[\s\S]*justify-self: end;[\s\S]*width: 100%;/.test(gamePlayScss), 'developer card must share the discussion sidebar right boundary')
assert(gameCommunityModelTs.includes('favorites: number') && gameCommunityModelTs.includes('shares: number'), 'game community model must expose favorite and share counts')
assert(gameCommunityOverviewTs.includes('favorites: Number(stats?.favorites') && gameCommunityOverviewTs.includes('shares: Number(stats?.shares'), 'community overview must return favorite and share counts')
assert(gameStatsSummaryTs.includes('declare shares: number'), 'game stats summary must persist share counts')
assert(gameShareControllerTs.includes("increment('shares'"), 'creating a share link must increment the game share count')
assert(communityPanelTs.includes('state.favorites') && communityPanelTs.includes('state.shares'), 'favorite and share actions must render numeric counts')
assert(!communityPanelTs.includes("state.favorite ? '已收藏' : '收藏'") && !communityPanelTs.includes('<strong>分享</strong>'), 'favorite and share actions must not render text labels instead of counts')
assert(
  /\.game-play-page \.game-title-developer \{\s+align-items: center;/.test(gamePlayScss) &&
    /\.game-play-page \.developer-identity img \{\s+align-self: center;/.test(gamePlayScss),
  'developer avatar must be vertically centered with the identity block'
)
assert(communityPanelTs.includes('gap: 2rem;'), 'game action row must use a wider consistent spacing rhythm')
assert(!gamePlayHtml.includes('iconName="download"') && !gamePlayHtml.includes('iconName="keyboard"') && !gamePlayHtml.includes('class="keyboard-shortcuts-hint"'), 'game controls must remove download, keyboard, and shortcut hint actions')
assert(
  ![ uploadHtml, uploadTs, libraryHtml, libraryTs, libraryScss, manageHtml, manageTs, gamesServiceTs ].some(body =>
    body.includes('下载游戏包') || body.includes('buildDownloadUrl') || body.includes('library-download')
  ),
  'GameHub must not expose game download actions or download URL helpers'
)
assert(gamePlayScss.includes('background: rgb(0 0 0 / 68%)') && gamePlayScss.includes('opacity: 0;') && gamePlayScss.includes('.game-stage:hover .game-player-controls'), 'game controls must be a hidden translucent overlay revealed on stage hover')
assert(commentsTs.includes('bili-composer-tool') && commentsTs.includes('accept="image/*"') && commentsTs.includes('添加表情'), 'comment composer must expose emoji and image controls')
assert(
  commentsTs.includes('role="button"') && commentsTs.includes('tabindex="0"') && commentsTs.includes('activateImagePicker'),
  'comment image control must be keyboard reachable and activate the file picker'
)
assert(
  commentsStoreTs.includes('private isCurrentRequest') &&
    (commentsStoreTs.match(/!this\.isCurrentRequest\(uuid, generation\)/g) || []).length >= 10,
  'comment mutations must ignore stale responses after switching games'
)
assert(
  commentsTs.includes('emojiOpen') && commentsTs.includes('class="bili-emoji-picker"') && commentsTs.includes('class="bili-emoji-option"') &&
    commentsTs.includes('(click)="toggleEmojiPicker($event)"') && commentsTs.includes('selectEmoji(emoji, commentInput') &&
    !commentsTs.includes('(click)="insertEmoji(commentInput)"'),
  'comment composer must expose a selectable emoji picker instead of inserting a fixed emoji directly'
)
assert(
    commentsTs.includes('height: 2rem;') && commentsTs.includes('width: 2rem;') &&
    commentsTs.includes('flex: 0 0 2rem;') &&
  commentsTs.includes('height: 1.25rem !important;') && commentsTs.includes('width: 1.25rem !important;') &&
    commentsTs.includes('my-global-icon ::ng-deep tabler-icon') &&
    commentsTs.includes('align-items: center;') && commentsTs.includes('justify-content: center;') &&
    commentsTs.includes('.bili-composer-tool-wrap:hover .bili-composer-tool') &&
    /\.bili-composer-tool\s*\{[^}]*margin: 0;/.test(commentsTs) &&
    (commentsTs.match(/class="bili-composer-tool-wrap"/g) || []).length >= 2,
  'comment emoji and image tools must share a centered control box and match the primary action icon size'
)
assert(
  communityPanelTs.includes('class="game-description-content"') &&
    /\.game-description-content\s*\{[\s\S]*display: flex;[\s\S]*flex-direction: column;[\s\S]*max-height: 260px;[\s\S]*overflow-y: auto;/.test(communityPanelTs) &&
    !communityPanelScss.includes('min-height: 72px'),
  'game overview and controls must size to content (no fixed min-height) with a bounded scrollable area, including fallback state'
)
// 2h) GameHub only supports text comments; the former star-rating/review
// subsystem must not remain reachable through public routes, models, or UI.
assert(!gameCommunityRouterTs.includes('communityReviewsRouter'), 'game community router must not mount the removed star-rating review routes')
assert(!existsSync(join(root, 'server/core/controllers/api/games/community-reviews.ts')), 'removed game review controller must not remain in the source tree')
assert(!existsSync(join(root, 'server/core/models/game/game-review.ts')), 'removed game review model must not remain in the source tree')
assert(!existsSync(join(root, 'packages/models/src/games/game-review.model.ts')), 'removed game review client contract must not remain in the source tree')
assert(!existsSync(join(root, 'packages/models/src/games/game-rating.model.ts')), 'removed game rating-distribution contract must not remain in the source tree')
assert(!gameCommunityServiceTs.includes('GameReview') && !gameCommunityServiceTs.includes('ratingDistribution') && !gameCommunityServiceTs.includes('review ('), 'community service must expose comments without star-rating APIs')
assert(!gamesServiceTs.includes('GameReview') && !gamesServiceTs.includes('GameRatingDistribution') && !gamesServiceTs.includes('ratingDistribution') && !gamesServiceTs.includes('review ('), 'legacy game review APIs must not be re-exported by GamesService')
assert(!gameCommunityModelTs.includes('reviews:') && !gameCommunityModelTs.includes('averageReviewScore'), 'game community state must not expose review totals or average scores')
assert(!gameStatsSummaryTs.includes('gameReview') && !gameStatsSummaryTs.includes('averageReviewScore') && !gameStatsSummaryTs.includes('declare reviews'), 'live game stats must aggregate comments instead of star reviews')
assert(gameSharedTs.includes("gameComments") && !gameSharedTs.includes("gameReviews"), 'game cards and metadata must use comment counts, not legacy review counts')
assert(!gameDiscoveryTs.includes('topRated') && !gameDiscoveryTs.includes('averageReviewScore') && !gameDiscoveryTs.includes('reviews:'), 'game rankings must not sort or expose star-review metrics')
assert(!gameDiscoveryServiceTs.includes('topRated') && !gameRankingsTs.includes('topRated') && !gameRankingsTs.includes('评分'), 'ranking UI and service must not offer star-rating sorting')
assert(!gameRankingModelTs.includes('reviews:') && !gameRankingModelTs.includes('averageReviewScore'), 'ranking contract must contain comments and engagement metrics only')
assert(!gameCreatorModelTs.includes('reviews:') && !gameAnalyticsServerTs.includes('gameReview') && !gameAnalyticsServerTs.includes('reviews:'), 'creator analytics must count comments without a separate review series')
assert(!analyticsTs.includes('breakdown.reviews') && !analyticsTs.includes('评价'), 'creator analytics UI must not show a star-review series')
assert(!openapiTs.includes('/api/v1/games/{uuid}/reviews:') && !openapiTs.includes('/api/v1/games/{uuid}/rating-distribution:') && !openapiTs.includes('topRated') && !openapiTs.includes('GameReview:') && !openapiTs.includes('GameRatingDistribution:'), 'OpenAPI must remove legacy game review and rating contracts')
assert(!openapiTs.includes('comment, reply, review, follow'), 'OpenAPI game activity kinds must not retain the removed review activity')
assert(gameAnalyticsServerTs.includes("game-analytics:v2:"), 'creator analytics cache key must invalidate the removed review-shaped payload')
assert((gameFeedTs.match(/\[Op\.ne\]: 'review'/g) || []).length >= 3, 'game feeds must filter historical review activities')
assert(gameTestsTs.includes('should not expose star rating distribution') && gameTestsTs.includes('HttpStatusCode.NOT_FOUND_404'), 'game API tests must enforce removal of the star rating distribution endpoint')
assert(!gamePlayScss.includes('.game-review-panel') && !gamePlayScss.includes('.review-score-picker') && !gamePlayScss.includes('.review-skeleton'), 'game detail styles must not retain dead star-review UI')
assert(!gameAboutTs.includes('ZIP') && !gameAboutTs.includes('下载原始游戏包') && gameAboutTs.includes('单个 HTML 文件'), 'about page must describe single HTML uploads without ZIP or download claims')
assert(
  gameAboutTs.includes('GameHub 社区') &&
    gameAboutTs.includes('游玩') &&
    gameAboutTs.includes('创作') &&
    gameAboutTs.includes('分享') &&
    gameAboutTs.includes('玩家指南') &&
    gameAboutTs.includes('创作者指南') &&
    gameAboutTs.includes('社区规则') &&
    !gameAboutTs.includes('GAMEHUB COMMUNITY') &&
    !gameAboutTs.includes('FOR PLAYERS') &&
    !gameAboutTs.includes('FOR CREATORS') &&
    !gameAboutTs.includes('COMMUNITY RULES'),
  'about page labels must stay localized for the Chinese GameHub experience'
)
assert(
  gameRuntimeTs.includes('replace(/<\\/body>/i'),
  'game runtime must inject before case-insensitive closing body tags'
)
assert(
  gameRuntimeTs.includes('const renderDomToCanvas = () =>') &&
    gameRuntimeTs.includes('renderDomToCanvas()') &&
    !gameRuntimeTs.includes('<foreignObject'),
  'the game runtime screenshot pipeline must render DOM screenshots directly to a canvas without unsupported SVG foreignObject content'
)
assert(
  uploadHtml.includes('accept=".html,.htm,text/html,application/xhtml+xml"') &&
    uploadHtml.includes('dragover') && uploadHtml.includes('onFileDrop') &&
    uploadHtml.includes('onFilePickerKeydown') && uploadTs.includes("'提交游戏'"),
  'game upload must expose a single HTML drop zone with click, drag, and keyboard submission paths'
)
assert(
  uploadHtml.includes('文件大小') && uploadHtml.includes('移除文件') &&
    uploadHtml.includes('正在上传并检查') && uploadHtml.includes('打开游戏'),
  'game upload must expose file state, loading feedback, and a success link'
)
assert(
  !uploadHtml.includes('upload-steps') && !uploadHtml.includes('upload-preview-frame') &&
    uploadHtml.includes('name="title"') && uploadHtml.includes('name="description"') &&
    uploadHtml.includes('name="instructions"') && uploadHtml.includes('name="category"') &&
    uploadHtml.includes('name="tags"'),
  'game upload must expose the full metadata form (title, description, instructions, category, tags) without the legacy multi-step or preview-frame scaffolding'
)
assert(
  uploadHtml.includes('accept="image/png,image/jpeg,image/webp"') &&
    uploadHtml.includes('onCoverChange'),
  'game upload must allow an optional single cover upload with image type validation'
)
assert(
  /\.upload-page\s*\{[\s\S]*?background:\s*var\(--game-form-surface-muted\)/.test(uploadScss) &&
    /\.upload-page\s*\{[\s\S]*?--game-form-radius:\s*var\(--game-radius-md\);/.test(uploadScss) &&
    /\.upload-page\s*> \.game-community-content\s*\{[\s\S]*?margin-inline:\s*auto;[\s\S]*?max-width:\s*760px;[\s\S]*?width:\s*min\(calc\(100% - \(var\(--game-space-page\) \* 2\)\), 760px\);/.test(uploadScss) &&
    /\.form-section\s*\{[\s\S]*?border-radius:\s*var\(--game-form-radius\);[\s\S]*?box-shadow:\s*var\(--game-form-shadow\)/.test(uploadScss) &&
    /\.form-section-heading::before\s*\{[\s\S]*?background:\s*var\(--game-brand\)/.test(uploadScss),
  'game upload must use a gray surface with elevated white form-section cards, a shared radius token, and a brand accent bar to match the detail-page visual contract'
)
assert(
  uploadTs.includes('isSupportedGameRuntimeFilename') &&
    uploadTs.includes('20 * 1024 * 1024') &&
    uploadTs.includes('this.gamesService.create(file, ') &&
    uploadTs.includes('inspectGameHtml') &&
    uploadTs.includes('inspectPromise') &&
    uploadTs.includes('data:text\\/html') &&
    uploadTs.includes('\\p{Cc}'),
  'game upload must validate the single HTML limit, inspect the file for auto-fill metadata, and submit the full form'
)
assert(
  uploadTs.includes('inspectGameHtml(source)') &&
    uploadTs.includes('inspection.title') &&
    uploadTs.includes('inspection.description') &&
    uploadTs.includes('inspection.instructions') &&
    uploadTs.includes('inspection.category') &&
    uploadTs.includes('inspection.tags'),
  'game upload must auto-fill title, description, instructions, category, and tags from the inspected HTML so authors rarely need to type manually'
)
assert(
  uploadTs.includes('onFilePickerKeydown') && uploadTs.includes('event.key !== \'Enter\'') &&
    uploadTs.includes('event.key !== \' \'') && uploadTs.includes('files.length > 1') &&
    uploadTs.includes('uploadDropZone?.nativeElement.focus') && uploadHtml.includes('#uploadDropZone'),
  'game upload must provide keyboard activation, reject multiple dropped files, and restore focus after removal'
)
const gameHtmlInspectorTs = read('client/src/app/+games/shared/game-html-inspector.ts')
assert(
  gameHtmlInspectorTs.includes('export function inspectGameHtml') &&
    gameHtmlInspectorTs.includes('INSTRUCTION_META_NAMES') &&
    gameHtmlInspectorTs.includes("'gamehub-instructions'") &&
    gameHtmlInspectorTs.includes("'instructions'") &&
    gameHtmlInspectorTs.includes("'controls'"),
  'game HTML inspector must prefer structured instruction meta tags before falling back to key-event scanning'
)
assert(
  gameHtmlInspectorTs.includes('scanInputEvents') &&
    gameHtmlInspectorTs.includes("'KeyW'") &&
    gameHtmlInspectorTs.includes("'ArrowUp'") &&
    gameHtmlInspectorTs.includes("'Space'") &&
    gameHtmlInspectorTs.includes('mouse') &&
    gameHtmlInspectorTs.includes('touch'),
  'game HTML inspector must scan keyboard, mouse, and touch signals to draft instructions when no meta tag is present'
)
assert(
  gameHtmlInspectorTs.includes('CATEGORY_KEYWORDS') &&
    gameHtmlInspectorTs.includes('detectCategory') &&
    gameHtmlInspectorTs.includes('scoreCategory') &&
    gameHtmlInspectorTs.includes("'horror'") &&
    gameHtmlInspectorTs.includes("'rpg'") &&
    gameHtmlInspectorTs.includes("'puzzle'"),
  'game HTML inspector must infer a category from title/meta/body keywords so authors do not have to pick one manually'
)
assert(
  gameHtmlInspectorTs.includes('extractTags') &&
    gameHtmlInspectorTs.includes('KEYWORDS_META_NAMES') &&
    gameHtmlInspectorTs.includes("'gamehub-keywords'") &&
    gameHtmlInspectorTs.includes('STOP_WORDS'),
  'game HTML inspector must extract tags from meta keywords or title words while filtering stop words'
)
assert(
  gameHtmlInspectorTs.includes('extractDescription') &&
    gameHtmlInspectorTs.includes('DESCRIPTION_META_NAMES') &&
    gameHtmlInspectorTs.includes('extractFirstVisibleText'),
  'game HTML inspector must derive a description from meta description or the first visible paragraph'
)
assert(
  gameCommunityDoc.includes('只接受单个 `.html` 或 `.htm` 文件') &&
    gameCommunityDoc.includes('禁止上传 ZIP') &&
    !gameCommunityDoc.includes('资源包：`.zip`'),
  'GameHub development docs must keep the single-HTML-only upload contract'
)
assert(
  gameCrudCreateTs.includes('cleanupStoredGameAssets') && gameCrudCreateTs.includes('root: CONFIG.STORAGE.GAMES_DIR') &&
    gameCrudCreateTs.includes('if (!persisted)'),
  'game creation must clean failed assets only before persistence and stay within the games storage root'
)
assert(
  gameCrudUpdateTs.includes('cleanupStoredGameAssets') && gameCrudUpdateTs.includes('root: CONFIG.STORAGE.GAMES_DIR') &&
    gameCrudUpdateTs.includes('if (!persisted)'),
  'game updates must clean failed assets only before persistence and stay within the games storage root'
)
assert(
  legacyGamePackageSpec.includes('状态：已废弃') && legacyGamePackagePlan.includes('状态：已废弃') &&
    gameRequirementsDoc.includes('当前契约说明') &&
    gameRequirementsDoc.includes('禁止 ZIP 和多文件资源包'),
  'legacy ZIP documents must be explicitly marked as historical and point to the current single-HTML contract'
)
assert(!loginHtml.includes('上传、编辑和下载'), 'login modal must not promise game downloads')
assert(
  loginHtml.includes('GameHub 账户') &&
    loginHtml.includes('开放注册') &&
    loginHtml.includes('game-auth-modal-close') &&
    !loginHtml.includes('GAMEHUB ACCOUNT') &&
    !loginHtml.includes('PLAY · CREATE · SHARE'),
  'login modal labels must stay localized for the Chinese GameHub experience'
)
const loginTs = read('client/src/app/+login/login-modal.component.ts')
const clientAuthServiceTs = read('client/src/app/core/auth/auth.service.ts')
assert(
  loginTs.includes('loadCaptcha ()') &&
    loginTs.includes('captchaId: this.captchaId,') &&
    loginHtml.includes('game-auth-captcha-image') &&
    loginHtml.includes('game-auth-captcha-svg') &&
    (loginHtml.match(/game-auth-captcha-image/g) || []).length >= 2 &&
    clientAuthServiceTs.includes('captchaToken') &&
    read('server/core/controllers/api/users/token.ts').includes('oauthPasswordGrantCaptchaValidator') &&
    read('server/core/controllers/api/users/registrations.ts').includes('authCaptchaValidator') &&
    read('server/core/lib/auth/captcha.ts').includes('getAndDeleteAuthCaptcha') &&
    openapi.includes('/api/v1/users/captcha') &&
    openapi.includes('getUserAuthCaptcha'),
  'login and registration must require a single-use image captcha end to end (modal UI, token/register endpoints, OpenAPI)'
)
const gameEyebrowStyleStart = gameCommunityTokens.indexOf('.game-eyebrow {')
const gameEyebrowStyleEnd = gameCommunityTokens.indexOf('}', gameEyebrowStyleStart)
const gameEyebrowStyle = gameCommunityTokens.slice(gameEyebrowStyleStart, gameEyebrowStyleEnd)
assert(
  gameEyebrowStyleStart >= 0 && !gameEyebrowStyle.includes('text-transform: uppercase'),
  'GameHub eyebrow labels must preserve brand casing instead of forcing uppercase text'
)
assert(
  gameAccountHomeTs.includes('GameHub 账户') &&
    !gameAccountHomeTs.includes('GAMEHUB ACCOUNT') &&
    gameAccountSettingsTs.includes('GameHub 账户') &&
    !gameAccountSettingsTs.includes('GAMEHUB ACCOUNT') &&
    gameNotFoundTs.includes('>GameHub</p>') &&
    !gameNotFoundTs.includes('>GAMEHUB</p>'),
  'GameHub account surfaces must not expose stray English labels'
)
assert(
  commentsTs.includes('height: 0.7rem;') && commentsTs.includes('width: 0.7rem;') &&
    commentsTs.includes('.bili-meta-btn my-global-icon ::ng-deep svg'),
  'comment like icons must use a smaller centered icon box'
)
assert(
  communityPanelTs.includes('padding: 0.25rem 0 0.3rem;') &&
    communityPanelTs.includes('padding-top: 0.45rem;') &&
    /\.description-tags\s*\{[\s\S]*margin-top: auto;/.test(communityPanelTs),
  'game interaction spacing must be compact and tags must sit at the bottom of the fixed overview area'
)
assert(
  headerScss.includes('--game-header-icon-size: 1.05rem;') &&
    /\.game-header-actions my-global-icon \{[\s\S]*height: var\(--game-header-icon-size\) !important;[\s\S]*width: var\(--game-header-icon-size\) !important;/.test(headerScss) &&
    headerScss.includes('my-global-icon ::ng-deep tabler-icon') &&
    /\.game-header-actions my-global-icon ::ng-deep svg \{[\s\S]*height: 100% !important;[\s\S]*width: 100% !important;/.test(headerScss),
  'navbar action icons must use a normalized icon box aligned with the navigation text'
)
const basePopoverBlock = readCssBlock(headerScss, '.game-header-popover')
const historyPopoverBlock = readCssBlock(headerScss, '.game-header-history-popover')
const creatorPopoverBlock = readCssBlock(headerScss, '.game-header-creator-popover')
const submitButtonBlock = readCssBlock(headerScss, '.game-submit-button')
assert(
  basePopoverBlock.includes('--game-popover-x: -50%;') &&
    basePopoverBlock.includes('--game-popover-edge-shift: 0%;') &&
    headerScss.includes('@starting-style {') &&
    /@starting-style \{[\s\S]*?\.game-header-popover/.test(headerScss) &&
    basePopoverBlock.includes('position: absolute;') &&
    basePopoverBlock.includes('transform: translateX(calc(var(--game-popover-x) - var(--game-popover-edge-shift)));') &&
    headerScss.includes('@media screen and (min-width: $mobile-view + 1px) and (max-width: $mobile-view + 30px)') &&
    headerScss.includes('@media screen and (min-width: $mobile-view + 31px) and (max-width: $mobile-view + 60px)') &&
    headerScss.includes('@media screen and (min-width: $mobile-view + 61px) and (max-width: $small-view)') &&
    headerScss.includes('--game-popover-edge-shift: 3rem;') &&
    headerScss.includes('--game-popover-edge-shift: 2rem;') &&
    headerScss.includes('--game-popover-edge-shift: 0.5rem;') &&
    historyPopoverBlock.includes('left: 50%;') &&
    historyPopoverBlock.includes('right: auto;') &&
    !historyPopoverBlock.includes('transform: none;') &&
    creatorPopoverBlock.includes('left: 50%;') &&
    creatorPopoverBlock.includes('right: auto;') &&
    !creatorPopoverBlock.includes('position: fixed;') &&
    !creatorPopoverBlock.includes('transform: none;') &&
    !creatorPopoverBlock.includes('top: 61px;') &&
    !headerScss.includes('.game-header-action-wrap:last-child .game-header-popover::before') &&
    submitButtonBlock.includes('align-items: center;') &&
    submitButtonBlock.includes('line-height: 1;'),
  'GameHub header popovers must stay centered on their action icons and the submit label must use an explicit centered line-height'
)
assert(
  basePopoverBlock.includes('width: 300px;') &&
    (headerScss.match(/\.game-header-(?:notification|list|history)-popover[^{]*\{[^}]*width:/g) || []).length === 0,
  '动态/收藏/历史 popovers must share the single narrowed width from the base popover rule without per-variant width overrides'
)
assert(
  headerTs.includes('POPOVER_HIDE_GRACE_MS = 700') &&
    headerTs.includes('POPOVER_FADE_MS = 200') &&
    headerTs.includes('if (other !== key && this.isPopoverMounted(other)) this.unmountPopoverNow(other)') &&
    /\.game-header-action-wrap::after,\s*\n\.logged-in-container::after \{[^}]*height: 0\.7rem;[^}]*top: 100%;/.test(headerScss.replace(/\r\n/g, '\n')),
  'header popovers must show at most one panel at a time, linger at most 1s after the pointer leaves, and keep a hover bridge over the trigger-to-popover gap'
)
assert(
  (headerTs.match(/this\.gameNavLoaded\.delete\(popup\)/g) || []).length >= 4,
  'header game navigation popovers must be retryable after a failed request'
)
assert(
  headerTs.includes('readonly gameNavLoading = signal<Record<GameHeaderPopup, boolean>>') &&
    headerTs.includes('isGameNavLoading (popup: GameHeaderPopup)') &&
    (headerHtml.match(/isGameNavLoading\('/g) || []).length >= 4 &&
    !headerHtml.includes('gameNavLoading() &&'),
  'header game navigation popovers must keep loading state per popup request'
)
assert(
  headerTs.includes('readonly gameNavCoverFallbacks = signal<Record<string, boolean>>') &&
    headerTs.includes('onGameNavCoverError (uuid: string)') &&
    headerHtml.includes('gameNavCoverFallbacks()[notification.game.uuid]') &&
    (headerHtml.match(/onGameNavCoverError\(/g) || []).length >= 3 &&
    headerScss.includes('.game-nav-cover') &&
    /\.game-nav-cover[\s\S]*height: 2\.6rem;[\s\S]*width: 4\.6rem;/.test(headerScss),
  'header game popover covers must use a fixed thumbnail box and recover after image failures'
)
assert(
  headerHtml.includes('(pointerenter)="scheduleGameAvatarMenu()"') &&
    headerHtml.includes('(pointerleave)="cancelGameAvatarHover()"') &&
    !headerHtml.includes('(mouseenter)="scheduleGameAvatarMenu()"') &&
    !headerHtml.includes('(mouseleave)="cancelGameAvatarHover()"'),
  'header avatar hover must use one pointer-event path without duplicate mouse handlers'
)
assert(
  headerHtml.includes('(focusin)="onGameAvatarFocusIn()"') &&
    headerHtml.includes('(focusout)="onGameAvatarFocusOut($event)"') &&
    headerHtml.includes(`[attr.aria-expanded]="isOpenPopover('avatar')"`) &&
    headerTs.includes('onGameAvatarFocusIn ()') &&
    headerTs.includes('onGameAvatarFocusOut (event: FocusEvent)'),
  'header avatar menu must expose the same delayed popup through keyboard focus'
)
const gameAvatarOccurrences = headerHtml.match(/class="game-user-avatar"/g) || []
assert(
  gameAvatarOccurrences.length === 1 &&
    !headerHtml.includes('game-avatar-hover-avatar') &&
    headerHtml.includes(`[class.game-avatar-menu-open]="isOpenPopover('avatar')"`),
  'GameHub avatar popover must use one avatar element and expose its open state on the wrapper'
)
const gameAvatarOpenButtonSelector = ':host-context(.game-experience) .logged-in-container.game-avatar-menu-open > .tertiary-button'
const gameAvatarOpenButtonStart = headerScss.indexOf(gameAvatarOpenButtonSelector)
const gameAvatarOpenButtonEnd = gameAvatarOpenButtonStart >= 0 ? headerScss.indexOf('}', gameAvatarOpenButtonStart) : -1
const gameAvatarOpenButtonBlock = gameAvatarOpenButtonEnd >= 0
  ? headerScss.slice(gameAvatarOpenButtonStart, gameAvatarOpenButtonEnd)
  : ''
const gameAvatarOpenImageBlock = readCssBlock(
  headerScss,
  ':host-context(.game-experience) .logged-in-container.game-avatar-menu-open > .tertiary-button .game-user-avatar'
)
const gameAvatarPopoverSelector = '.game-avatar-hover-card {\n  transition: opacity var(--game-dur) var(--game-ease);\n  background:'
const gameAvatarPopoverStart = headerScss.indexOf(gameAvatarPopoverSelector)
const gameAvatarPopoverEnd = gameAvatarPopoverStart >= 0 ? headerScss.indexOf('}', gameAvatarPopoverStart) : -1
const gameAvatarPopoverBlock = gameAvatarPopoverEnd >= 0
  ? headerScss.slice(gameAvatarPopoverStart, gameAvatarPopoverEnd)
  : ''
assert(
  gameAvatarOpenButtonBlock.includes('transform: translate3d(0, calc(var(--header-height) / 2 + 0.5rem), 0);') &&
    gameAvatarOpenButtonBlock.includes('box-shadow: none !important;') &&
    gameAvatarOpenImageBlock.includes('transform: scale(2.12);') &&
    headerScss.includes('transform-origin: center;') &&
    headerScss.includes('will-change: transform;') &&
    headerScss.includes('transition: box-shadow var(--game-dur) var(--game-ease),') &&
    headerScss.includes('transform var(--game-dur-slow) var(--game-ease);') &&
    headerScss.includes('padding: 4.25rem 1.1rem 1rem;'),
  'GameHub avatar popover must move the trigger shell and scale the single avatar at the centered card edge without leaving the original hover ring'
)
assert(
    headerScss.includes('overflow: visible;') &&
    headerScss.includes('z-index: 61;') &&
    headerScss.includes('@media screen and (max-width: $mobile-view)') &&
    headerScss.includes('    .logged-in-container.game-avatar-menu-open > .tertiary-button {\n      transform: none;\n    }') &&
    headerScss.includes('transform: none;') &&
    headerScss.includes('max-width: calc(100vw - 1rem);') &&
    gameAvatarPopoverBlock.includes('left: 50%;') &&
    gameAvatarPopoverBlock.includes('right: auto;') &&
    gameAvatarPopoverBlock.includes('transform: translateX(-50%);') &&
    headerScss.includes('width: min(300px, calc(100vw - 1rem));'),
  'GameHub avatar transition must keep the transformed image above the card, disable cross-header motion on mobile, keep the card inside narrow viewports, and center the desktop card on its avatar trigger'
)
assert(
  headerHtml.includes('id="game-avatar-menu"') &&
    headerHtml.includes('[attr.aria-controls]="\'game-avatar-menu\'"') &&
    headerHtml.includes('aria-haspopup="dialog"') &&
    headerHtml.includes('role="dialog"') &&
    headerHtml.includes('(pointerdown)="onGameAvatarPointerDown($event)"') &&
    headerHtml.includes('(pointerup)="onGameAvatarPointerUp($event)"') &&
    headerHtml.includes('(pointercancel)="onGameAvatarPointerUp($event)"') &&
    headerHtml.includes('routerLink="/my-account"') &&
    headerHtml.includes('routerLink]="[ \'/games/author\', user.account.id ]"') &&
    headerHtml.includes('user?.account?.followingCount') &&
    headerHtml.includes('user?.account?.followersCount') &&
    headerHtml.includes('gameCount()'),
  'account popover must expose personal center, public profile, following, follower, and game-count content'
)
assert(
  headerTs.includes('readonly gameCount = signal<number | null>(null)') &&
    headerTs.includes('this.gameCount.set(overview.gameCount)') &&
    headerTs.includes('this.gameCount.set(null)') &&
    headerTs.includes('toggleGameAvatarMenu (event: MouseEvent)') &&
    headerTs.includes('onGameAvatarPointerDown (event: PointerEvent)') &&
    headerTs.includes('onGameAvatarPointerUp (event: PointerEvent)') &&
    headerTs.includes('event.detail > 0 && this.gameAvatarHoverOpened') &&
    headerTs.includes('closeGameAvatarMenu (event: KeyboardEvent)') &&
    headerTs.includes('event.detail === 0 && this.gameAvatarFocusOpened') &&
    headerTs.includes("@HostListener('window:keydown', [ '$event' ])") &&
    headerTs.includes('onGameWindowKeydown (event: KeyboardEvent)'),
  'account popover must load and clear game count and provide click and Escape interaction handlers'
)
const avatarScheduleStart = headerTs.indexOf('scheduleGameAvatarMenu ()')
const avatarScheduleEnd = headerTs.indexOf('\n  cancelGameAvatarHover', avatarScheduleStart)
assert(
  avatarScheduleStart >= 0 &&
    avatarScheduleEnd > avatarScheduleStart &&
    headerTs.slice(avatarScheduleStart, avatarScheduleEnd).includes('this.suppressGameAvatarFocus'),
  'Escape must not immediately reopen the account popover when focus returns to the avatar trigger'
)
assert(
  headerTs.includes("private setPopoverOpen (key: string, open: boolean, closeGraceMs = HeaderComponent.POPOVER_HIDE_GRACE_MS)") &&
    headerTs.includes("this.setPopoverOpen('avatar', false, 0)") &&
    headerTs.includes('if (closeGraceMs === 0) {') &&
    headerTs.includes('startClosing()'),
  'avatar menu close must start its fade at the same time as the trigger returns to its resting state'
)
assert(
    headerScss.includes('grid-template-columns: repeat(3, minmax(0, 1fr));') &&
    headerScss.includes('max-width: calc(100vw - 1rem);') &&
    headerScss.includes('.game-avatar-action:focus-visible') &&
    headerScss.includes('@media (prefers-reduced-motion: reduce)') &&
    /\.game-avatar-action,\s*\n\s*\.game-avatar-logout \{[\s\S]*?transition: none;/.test(headerScss),
  'account popover stats must have a three-column, viewport-safe, focus-visible, reduced-motion style contract'
)
assert(
  headerTs.includes('this.gameAvatarRequestGeneration++') &&
    headerTs.includes('this.gameAvatarRequestGeneration === generation') &&
    headerTs.includes('this.getGameAccountKey() === accountKey') &&
    headerTs.includes('getCreatorOverview ()') &&
    headerTs.includes('shareReplay({ bufferSize: 1, refCount: false })'),
  'account overview responses must be scoped to the current account and shared across creator/avatar popovers'
)
const gameNavLoaderStart = headerTs.indexOf('private loadGameNavData (popup: GameHeaderPopup)')
const gameNavLoaderEnd = headerTs.indexOf('\n  toggleGameAvatarMenu', gameNavLoaderStart)
assert(
  gameNavLoaderStart >= 0 &&
    gameNavLoaderEnd > gameNavLoaderStart &&
    headerTs.slice(gameNavLoaderStart, gameNavLoaderEnd).includes('const accountKey = this.getGameAccountKey()') &&
    headerTs.slice(gameNavLoaderStart, gameNavLoaderEnd).includes('const accountGeneration = this.gameAvatarRequestGeneration') &&
    headerTs.slice(gameNavLoaderStart, gameNavLoaderEnd).includes('this.gameAvatarRequestGeneration === accountGeneration') &&
    headerTs.slice(gameNavLoaderStart, gameNavLoaderEnd).includes('this.getGameAccountKey() === accountKey'),
  'game navigation responses must be discarded after an account switch even when popup generations restart'
)
assert(
  headerHtml.includes('i18n-aria-label') &&
    headerHtml.includes('<span i18n>关注</span>') &&
    headerHtml.includes('<span i18n>粉丝</span>') &&
    headerHtml.includes('<span i18n>动态</span>') &&
    headerHtml.includes('<span i18n>个人中心</span>') &&
    headerHtml.includes('<span i18n>我的主页</span>'),
  'account popover labels and accessible names must be extractable by client i18n'
)
for (const popup of [ 'notifications', 'favorites', 'history', 'creator' ]) {
  assert(
    headerHtml.includes(`(pointerenter)="scheduleGameNavHover('${popup}')"`) &&
      headerHtml.includes(`(pointerleave)="cancelGameNavHover('${popup}')"`) &&
      headerHtml.includes(`(pointerenter)="retainGameNavHover('${popup}')"`) &&
      !headerHtml.includes(`(mouseenter)="scheduleGameNavHover('${popup}')"`) &&
      !headerHtml.includes('(mouseleave)="cancelGameNavHover()"'),
    `header ${popup} hover entry must use one pointer-event path without duplicate mouse handlers`
  )
}
const gameNavPopoverSections = headerHtml.match(/<section[^>]*game-header-popover[^>]*>/g) || []
console.error('DBG3 len=' + gameNavPopoverSections.length + ' hidden=' + (headerHtml.match(/game-popover-hidden/g) || []).length + ' htmlSize=' + headerHtml.length)
assert(
  (headerHtml.match(/retainGameNavHover\('/g) || []).length >= 4 &&
  (headerHtml.match(/cancelGameNavHover\('/g) || []).length >= 4 &&
  (headerHtml.match(/game-popover-hidden/g) || []).length >= 5 &&
  !headerHtml.includes('(mouseenter)="retainGameNavHover()"') &&
  !headerHtml.includes('(mouseleave)="cancelGameNavHover()"'),
  'header hover popovers must keep keyed retain/cancel handlers and the fade-out class without duplicate mouse handlers'
)
assert(
  headerHtml.includes('<header><strong>动态</strong></header>') &&
    headerHtml.includes('<header><strong>我的收藏</strong></header>') &&
    headerHtml.includes('<header><strong>游玩历史</strong></header>') &&
    headerHtml.includes('<footer><a routerLink="/games/notifications">查看全部动态</a></footer>') &&
    headerHtml.includes('[queryParams]="{ tab: \'favorites\' }">查看全部收藏</a></footer>') &&
    headerHtml.includes('[queryParams]="{ tab: \'recent\' }">查看全部历史</a></footer>') &&
    headerScss.includes('.game-header-popover > header'),
  'header 动态/收藏/历史 popovers must open with a bilibili-style title header and close with a full-list footer link'
)
assert(
  /\.game-nav-game \{[\s\S]*?-webkit-line-clamp: 2;[\s\S]*?white-space: normal;[\s\S]*?\}/.test(headerScss) &&
    !/\.game-nav-game \{[^}]*white-space: nowrap/.test(headerScss),
  'header popover game titles must wrap up to two lines like the bilibili reference instead of a single ellipsis line'
)
assert(
  asyncStateTs.includes('let requestGeneration = 0') &&
    (asyncStateTs.match(/const generation = \+\+requestGeneration/g) || []).length >= 2 &&
    asyncStateTs.includes('const generation = requestGeneration') &&
    (asyncStateTs.match(/if \(generation !== requestGeneration\) return/g) || []).length >= 6 &&
    asyncStateTs.includes('requestGeneration += 1'),
  'shared async state must ignore stale loads and reset in-flight responses'
)
assert(
  activityFeedTs.includes('private requestGeneration = 0') &&
    activityFeedTs.includes('const generation = ++this.requestGeneration') &&
    activityFeedTs.includes('const rollbackOffset = this.offset') &&
    activityFeedTs.includes('this.loadingMore.set(false)') &&
    (activityFeedTs.match(/if \(generation !== this\.requestGeneration\) return/g) || []).length >= 2,
  'activity feed must ignore stale tab responses and recover pagination state after failures'
)
assert(
  commentsStoreTs.includes('private hasLoadedMore = false') &&
    commentsStoreTs.includes('this.hasLoadedMore = true') &&
    commentsStoreTs.includes('mergeRefreshedComments') &&
    commentsStoreTs.includes('this.comments.set(this.mergeRefreshedComments(result.data))'),
  'comment polling must preserve loaded pages while refreshing the latest comments'
)
assert(
  /private refresh \(\) \{[\s\S]*?subscribe\(\{[\s\S]*?error: \(\) =>/.test(commentsStoreTs) &&
    /private refresh \(\) \{[\s\S]*?subscribe\(\{[\s\S]*?error: \(\) =>/.test(discussStoreTs),
  'comment and discussion polling must handle transient request failures without global console errors'
)
assert(
  /\.game-header-left-nav a:hover,[\s\S]*?background: var\(--game-surface-alt\);[\s\S]*?color: var\(--game-text-primary\) !important;/.test(headerScss) &&
    /\.game-header-actions a:hover,[\s\S]*?background: var\(--game-surface-alt\);[\s\S]*?color: var\(--game-text-primary\) !important;/.test(headerScss) &&
    /\.game-header-actions a\.game-header-action-active \{[\s\S]*color: var\(--game-brand-deep\) !important;/.test(headerScss) &&
    /\.game-header-left-nav a\.active \{[\s\S]*border-bottom-color: var\(--game-brand\);[\s\S]*color: var\(--game-brand-deep\) !important;/.test(headerScss),
  'GameHub navigation must use the shared hover surface and brand active states'
)
assert(
  headerScss.includes('background: transparent;') &&
    headerScss.includes('border-bottom: 0;') &&
    /:host-context\(.game-experience\.game-header-scrolled\) \.root\s*\{[\s\S]*?background-color: var\(--game-surface\);/.test(headerScss) &&
    !headerScss.includes('backdrop-filter: blur(16px) saturate(1.5);') &&
    headerScss.includes('height: var(--header-height);') &&
    appScss.includes('--header-height: 56px;') &&
    !appScss.includes('--header-height: 200px;') &&
    !appScss.includes('--header-height: 50px;') &&
    /\.game-category-rail\s*\{[\s\S]*?background:\s*var\(--game-surface\);/.test(gamesHomeDiscoveryNavScss),
  'GameHub desktop header must float over the home banner and become an opaque white bar after scrolling'
)
assert(
  gamesIndexTs.indexOf("gamesRouter.use('/', discoveryRouter)") >= 0 &&
    gamesIndexTs.indexOf("gamesRouter.use('/', discoveryRouter)") < gamesIndexTs.indexOf("gamesRouter.use('/', crudRouter)") &&
    gamesIndexTs.indexOf("gamesRouter.use('/', personalRouter)") < gamesIndexTs.indexOf("gamesRouter.use('/', crudRouter)") &&
    gamesIndexTs.indexOf("gamesRouter.use('/', collectionRouter)") < gamesIndexTs.indexOf("gamesRouter.use('/', crudRouter)"),
  'GameHub static discovery, personal, and collection routes must be registered before the /:uuid CRUD route'
)
assert(
  databaseTs.includes("import { GameCollectionModel, GameCollectionItemModel } from '../models/game/game-collection.js'") &&
    databaseTs.includes('GameCollectionModel,') && databaseTs.includes('GameCollectionItemModel,') &&
    !gameDiscoveryServerTs.includes('const [ rows ] = await sequelizeTypescript.query') &&
    gameDiscoveryServerTs.includes('const rows = await sequelizeTypescript.query'),
  'GameHub discovery and collection APIs must register their Sequelize models and consume SELECT query rows correctly'
)
const analyticsSelectDestructures = gameAnalyticsServerTs.match(/const \[ rows \] = await sequelizeTypescript\.query/g) || []
assert(
  analyticsSelectDestructures.length === 0 &&
    (gameAnalyticsServerTs.match(/const rows = await sequelizeTypescript\.query/g) || []).length >= 3,
  'creator analytics must consume Sequelize SELECT rows as an array instead of destructuring the first row'
)
assert(
  !gameFeedTs.includes('const [ actorRows ] = await sequelizeTypescript.query') &&
    gameFeedTs.includes('const actorRows = await sequelizeTypescript.query'),
  'following feed must consume the actor account SELECT result as an array'
)
assert(
  (personalLibraryTs.match(/subQuery:\s*false/g) || []).length >= 2,
  'personal library game queries must disable the Sequelize subquery so joined stats aliases remain valid'
)
assert(
  (personalLibraryTs.match(/getPublicStatsAttributes\('Game->StatsSummary'\)/g) || []).length >= 2,
  'personal library game queries must use the nested Game->StatsSummary alias for joined stats'
)
assert(
  !gameFeedTs.includes('model: ActorFollowModel') && gameFeedTs.includes('AccountModel.findByPk(accountId)'),
  'following feed must not eager-load ActorFollowModel from AccountModel'
)
assert(
  personalAuthorTs.includes("[ fn('COUNT', col('id')), 'gameCount' ]") &&
    personalAuthorTs.includes("group: [ 'ownerAccountId' ]") &&
    personalAuthorTs.includes('actor.accountId || actor.VideoChannel?.accountId') &&
    personalAuthorTs.includes('id: account.id') &&
    !personalAuthorTs.includes('model: GameModel'),
  'following authors must aggregate published games by owner account instead of eager-loading an invalid ActorModel -> GameModel association'
)
assert(
  gameAnalyticsServerTs.includes('INNER JOIN "actor" ON "actor"."id" = "actorFollow"."targetActorId"') &&
    gameAnalyticsServerTs.includes('"actor"."accountId" = :accountId') &&
    gameAnalyticsServerTs.includes('DATE("actorFollow"."createdAt")') &&
    gameAnalyticsServerTs.includes('"actorFollow"."state"') &&
    !gameAnalyticsServerTs.includes('a."actorId"') &&
    !gameAnalyticsServerTs.includes('"ActorFollow"."createdAt"'),
  'creator follower analytics must join the actor account through actor.accountId'
)
assert(
  /\.game-play-page \.play-side \{[\s\S]*height: auto;[\s\S]*min-height: var\(--game-stage-height\);/.test(gamePlayScss) &&
    gamePlayScss.includes('height: var(--stage-box-height,') &&
    
    gamePlayHtml.includes('[style.--stage-box-height]="stageBoxHeightPx()"') &&
    gamePlayTs.includes('syncStageHeight ()'),
  'detail sidebar must grow with recommendations while the discussion panel mirrors the measured stage height'
)
assert(
  /class="bili-send-btn"\s+\[disabled\]="!store\.draft\(\)\.trim\(\) \|\| store\.submitting\(\)"/.test(commentsTs) &&
    commentsTs.includes('{{ store.submitting() ?'),
  'comment composer must use a disabled gray send button for empty text or an in-flight request'
)
assert(
  commentsStoreTs.includes('readonly submitting = signal(false)') &&
    discussStoreTs.includes('readonly submitting = signal(false)') &&
    commentsTs.includes('[disabled]="!store.draft().trim() || store.submitting()"') &&
    discussTs.includes('[disabled]="!store.draft().trim() || store.submitting()"') &&
    commentsTs.includes('{{ store.submitting() ?') &&
    discussTs.includes('{{ store.submitting() ?') &&
    (commentsStoreTs.match(/this\.submitting\(\)\) return/g) || []).length >= 2 &&
    discussStoreTs.includes('this.submitting()) return'),
  'comment and discussion composers must lock repeated submissions until the current request completes'
)
assert(commentsTs.includes('height: 20px;') && commentsTs.includes('line-height: 20px;'), 'comment metadata controls must use a fixed centered line box')
assert((gameCommunityOverviewTs.match(/subQuery: false/g) || []).length >= 2, 'related games queries must disable Sequelize subqueries for joined stats')
assert(
  /playCount: number\s+comments: number/.test(gameCommunityModelTs),
  'related game model must expose the comment count instead of a like count'
)
assert(
  gameCommunityOverviewTs.includes("comments: Number(g.get?.('gameComments') ?? 0)") &&
    !gameCommunityOverviewTs.includes("likes: Number(g.get?.('gameLikes') ?? 0)"),
  'related game API must return the joined comment count instead of likes'
)
assert(
  !featuredHtml.includes('[style.background]="featuredCoverFade(featuredGame)"') &&
    !featuredHtml.includes('onFeaturedImageLoad'),
  'featured carousel must not bind an average-color fade to real covers'
)
assert(
  !featuredHtml.includes('[class.tone-bg]="!featuredCoverPath(featuredGame)"') &&
    !featuredHtml.includes('[style.background]="featuredCoverPath(featuredGame) ? featuredAvgColor(featuredGame) : null"') &&
    !featuredScss.includes('.featured-footer.tone-bg') &&
    featuredScss.includes('background: transparent;') &&
    !featuredScss.includes('border-top: 1px solid var(--game-border);'),
  'featured carousel footer must stay in the shared transparent page layer without a color gradient'
)
assert(
  !featuredScss.includes('linear-gradient'),
  'featured carousel must not use a chrome gradient'
)
assert(
  !featuredScss.includes('background-color: #8f6a51'),
  'featured carousel footer must not regress to the removed brown placeholder fallback'
)

// 4) Light-build scripts must select the Chinese locale while keeping the
// compatibility output path expected by the current server deployment.
const lightPs1 = read('scripts/build/client-light.ps1')
assert(
  lightPs1.includes('--configuration production,zh-Hans-light') && lightPs1.includes('dist/browser/en-US'),
  'client-light.ps1 must build the zh-Hans-light configuration to dist/browser/en-US'
)
const clientIndex = read('client/src/index.html')
assert(
  clientIndex.includes('href="/client/assets/images/gamehub-favicon.svg'),
  'client index favicon must resolve through the shared /client asset path'
)
const clientSh = read('scripts/build/client.sh')
assert(
  clientSh.includes('--configuration production,zh-Hans-light') && clientSh.includes('dist/browser/$defaultLanguage'),
  'client.sh light path must build the zh-Hans-light configuration to the compatibility locale directory'
)
const angularConfig = JSON.parse(read('client/angular.json'))
const angularProject = Object.values(angularConfig.projects ?? {}).find(project => project?.architect?.build)
const angularLocales = angularProject?.i18n?.locales ?? {}
assert(
  angularLocales['zh-Hans-CN']?.baseHref === expectedBaseHref,
  'Angular zh-Hans-CN locale must use the /client/en-US/ compatibility base href'
)
assert(
  angularProject?.architect?.build?.configurations?.['zh-Hans-light']?.localize?.[0] === 'zh-Hans-CN',
  'Angular zh-Hans-light must localize the light build as zh-Hans-CN'
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

  const builtJs = collectFiles(join(root, 'client/dist/browser'), '.js')
  const builtBodies = builtJs.map(file => readFileSync(file, 'utf8'))
  for (const [index, body] of builtBodies.entries()) {
    assertBundleContract(body, `built bundle ${builtJs[index]}`)
  }
}

const gamehubPaletteSources = [
  appScss,
  headerScss,
  gameNavigationScss,
  gameCommunityTokens,
  gamesHomeScss,
  gamePlayScss,
  discussTs,
  commentsTs,
  featuredScss,
  gameSectionTs,
  gameEmptyStateTs,
  gameErrorRetryTs
].join('\n')
assert(
  gameCommunityTokens.includes('--game-text: #18191c') &&
    gameCommunityTokens.includes('--game-text-button: #4e5358') &&
    gameCommunityTokens.includes('--game-text-hint: #737a81') &&
    gameCommunityTokens.includes('--game-muted: #61666d') &&
    !appScss.includes('--game-text:') &&
    !headerScss.includes('--game-text-primary: #'),
  'GameHub shared palette must keep the ink scale in the single token source without component-level duplicates'
)
assert(
  !/(#303133|#4e5969|#646970|#6b6f75|#6b7280|#666(?:\b|;)|#999(?:\b|;)|rgb\(78 89 105)/i.test(gamehubPaletteSources),
  'GameHub surfaces must not retain the legacy inconsistent text gray palette'
)

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

    const pendingScripts = [ ...liveScripts ]
    const visitedScripts = new Set()

    while (pendingScripts.length) {
      const src = pendingScripts.shift()
      let absUrl
      if (/^https?:\/\//i.test(src)) {
        absUrl = src
      } else if (src.startsWith('/')) {
        absUrl = `${base}${src}`
      } else {
        const b = liveBase.endsWith('/') ? liveBase : `${liveBase}/`
        absUrl = new URL(src, `${base}${b}`).href
      }

      if (visitedScripts.has(absUrl)) continue
      visitedScripts.add(absUrl)

      const res = await fetch(absUrl, { method: 'GET' })
      const ct = (res.headers.get('content-type') || '').toLowerCase()
      assert(res.status === 200, `SPA script ${absUrl} must return 200, got ${res.status}`)
      assert(
        ct.includes('javascript') || ct.includes('ecmascript'),
        `SPA script ${absUrl} must be JS Content-Type, got ${ct || '(missing)'}`
      )
      // Extra guard: body must not look like the HTML shell
      const body = await res.text()
      const bodyStart = body.slice(0, 64).toLowerCase()
      assert(
        !bodyStart.includes('<!doctype html') && !bodyStart.includes('<html'),
        `SPA script ${absUrl} body must not be HTML fallback`
      )
      assertBundleContract(body, `live bundle ${absUrl}`)
      for (const match of body.matchAll(/(?:from|import\()\s*["'](\.\/[^"']+\.js)["']/g)) {
        pendingScripts.push(new URL(match[1], absUrl).href)
      }
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
console.log(' - GameHub source asset contracts')
console.log(' - server dist/browser contracts')
console.log(' - high-priority feature sources/routes')
console.log(' - light build emits the Chinese locale through /client/en-US/')
if (existsSync(join(root, 'client/dist/browser'))) {
  console.log(' - client dist layout + SPA script disk paths')
  for (const p of resolvedScriptPaths) console.log(`   script ${p}`)
}
if (verifyBase) {
  console.log(` - live SPA scripts under ${verifyBase} are application/javascript`)
}
