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
const gameSectionTs = read('client/src/app/+games/games-home/game-section.component.ts')
const gamesIndexTs = read('server/core/controllers/api/games/index.ts')
const gameMetaTagsTs = read('client/src/app/+games/services/game-meta-tags.ts')
const homeConstantsTs = read('client/src/app/+games/games-home.constants.ts')
const navigationTs = read('client/src/app/header/game-navigation.component.ts')
const navigationHtml = read('client/src/app/header/game-navigation.component.html')
const eventDetailTs = read('client/src/app/+games/game-event-detail.component.ts')
const collectionDetailTs = read('client/src/app/+games/game-collection-detail.component.ts')
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
assert(
  rankings.includes('{{ formatNumber(game.stats.comments) }} 评论') &&
    !rankings.includes('{{ formatNumber(game.stats.likes) }} 点赞') &&
    !rankings.includes('{{ formatNumber(game.stats.favorites) }} 收藏'),
  'ranking game items must use play and comment counts instead of the legacy like/favorite stats'
)

const playHtml = read('client/src/app/+games/game-play.component.html')
assert(playHtml.includes('game-stage') && playHtml.includes('<iframe'), 'game-play must render the HTML game stage')
assert(playHtml.includes('developer-profile'), 'game-play developer card must group identity text and follow action for vertical centering')
assert(playHtml.includes('onRelatedCoverError'), 'game-play related covers must fall back when an image request fails')
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
assert(authorHtml.includes('author-pinned') || authorHtml.includes('pinned-badge'), 'author page must show pinned works')
assert(!authorHtml.includes('account.handle'), 'author page must not render an account handle in the visible profile')
assert(
  authorHtml.includes('{{ formatNumber(author()!.data[0].comments || 0) }} 评论') &&
    !authorHtml.includes('{{ formatNumber(author()!.data[0].likes || 0) }} 点赞') &&
    !authorHtml.includes('{{ formatNumber(author()!.data[0].favorites || 0) }} 收藏'),
  'author pinned game stats must use play and comment counts instead of the legacy like/favorite stats'
)

assert(homeTs.includes('GameRecommendService') && homeTs.includes('recommendService'), 'games-home must wire GameRecommendService personalization')
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
    (homeTs.match(/if \(!this\.isCurrentRequest\(generation\)\) return/g) || []).length >= 8,
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
assert(!eventDetailTs.includes('返回活动列表') && !collectionDetailTs.includes('浏览全部专题') && !collectionDetailTs.includes('返回专题列表'), 'game detail states must not render legacy return buttons')

const featuredTs = read('client/src/app/+games/games-home/featured-carousel.component.ts')
assert(
  featuredTs.includes(".replace(/,\\s*/g, ' ')") || featuredTs.includes('.replace(/,\\s*/g, " ")'),
  'featured carousel must normalize comma RGB values before slash-alpha gradients'
)
assert(
  featuredTs.includes('sampleHeight = Math.max(1, Math.round(canvas.height * 0.1))'),
  'featured carousel must sample the bottom tenth of a cover instead of the whole image'
)
assert(
  featuredTs.includes('const segmentCount = 5'),
  'featured carousel must calculate five horizontal bottom-cover color segments'
)
assert(
  featuredTs.includes('FEATURED_PLACEHOLDER_AVG_RGB'),
  'featured carousel must use the visible brown placeholder average as its no-cover fallback'
)
const featuredHtml = read('client/src/app/+games/games-home/featured-carousel.component.html')
const featuredScss = read('client/src/app/+games/games-home/featured-carousel.component.scss')
const featuredFadeStyleStart = featuredScss.indexOf('.featured-cover-fade')
const featuredFadeStyleEnd = featuredFadeStyleStart >= 0
  ? featuredScss.indexOf('}', featuredFadeStyleStart)
  : -1
const featuredFadeStyle = featuredScss.slice(featuredFadeStyleStart, featuredFadeStyleEnd)
assert(
  featuredFadeStyle.includes('height: 10%'),
  'featured carousel cover fade must cover exactly the bottom tenth of the cover'
)
assert(
  featuredHtml.includes("[attr.aria-current]=\"index === carouselIndex() ? 'true' : null\""),
  'featured carousel indicators must expose the active recommendation with aria-current'
)
const gameCardHtml = read('client/src/app/+games/game-card.component.html')
const gameCardScss = read('client/src/app/+games/game-card.component.scss')
const notificationHtml = read('client/src/app/+games/game-notifications.component.html')
assert(
  gameCardHtml.includes('[innerHTML]="game.title | highlight: searchTerm"') &&
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
assert(!gameCardScss.includes('.game-card:hover'), 'game cards must not add a hover highlight overlay or lift effect')
assert(!gameCardScss.includes('transform: scale(1.035)'), 'game card covers must not zoom on hover')
assert(
  notificationHtml.includes('class="notification-item"') &&
    notificationHtml.includes('(click)="markRead(notification)"') &&
    !/<article class="notification-item"[^>]*role="button"/.test(notificationHtml) &&
    !/<article class="notification-item"[^>]*tabindex="0"/.test(notificationHtml),
  'notification rows must not expose a composite button role around their link and delete button'
)
const gamePlayHtml = read('client/src/app/+games/game-play.component.html')
const gamePlayTs = read('client/src/app/+games/game-play.component.ts')
const gamePlayScss = read('client/src/app/+games/game-play.component.scss')
const discussTs = read('client/src/app/+games/game-discuss.component.ts')
const discussStoreTs = read('client/src/app/+games/game-discuss-store.ts')
const gameCommunityServiceTs = read('client/src/app/+games/services/game-community.service.ts')
const communityPanelTs = read('client/src/app/+games/game-community-panel.component.ts')
const gameCommunityTokens = read('client/src/app/+games/game-community.tokens.scss')
const commentsTs = read('client/src/app/+games/game-comments.component.ts')
const commentsStoreTs = read('client/src/app/+games/game-comments-store.ts')
const commentsStoreImplementation = commentsStoreTs.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
const headerTs = read('client/src/app/header/header.component.ts')
const headerHtml = read('client/src/app/header/header.component.html')
const asyncStateTs = read('client/src/app/+games/shared/async-state.ts')
const activityFeedTs = read('client/src/app/+games/game-activity-feed.component.ts')
const headerScss = read('client/src/app/header/header.component.scss')
const appScss = read('client/src/app/app.component.scss')
const gamesHomeScss = read('client/src/app/+games/games-home.component.scss')
assert(
  (homeHtml.match(/\[class\.category-length-2\]/g) || []).length >= 2 &&
    (homeHtml.match(/\[class\.category-length-3\]/g) || []).length >= 2,
  'home category links must bind length-aware spacing classes in both populated and empty states'
)
assert(
  !gamesHomeScss.includes('.home-category-links a:nth-child(6)') &&
    gamesHomeScss.includes('display: inline-flex;') &&
    gamesHomeScss.includes('width: 4.8rem;') &&
    gamesHomeScss.includes('min-width: 4.8rem;'),
  'home category links must use an order-independent fixed four-character button width'
)
assert(
  gamesHomeScss.includes('grid-template-columns: repeat(5, minmax(0, 1fr));') &&
    !gamesHomeScss.includes('grid-template-columns: repeat(4, minmax(0, 1fr));'),
  'desktop game grids must keep five columns across supported desktop widths'
)
assert(
  /\.game-submit-button\s*\{[\s\S]*?font-weight: 400;[\s\S]*?\}/.test(headerScss),
  'GameHub submit navigation text must use regular weight instead of bold styling'
)
const gameCommunityOverviewTs = read('server/core/controllers/api/games/community-overview.ts')
const gameCommunityModelTs = read('packages/models/src/games/game-community.model.ts')
const gameStatsSummaryTs = read('server/core/models/game/game-stats-summary.ts')
const gameSharedTs = read('server/core/controllers/api/games/game-shared.ts')
const gameDiscoveryTs = read('server/core/controllers/api/games/game-discovery.ts')
const gameDiscoveryServiceTs = read('client/src/app/+games/services/game-discovery.service.ts')
const gameRankingsTs = read('client/src/app/+games/game-rankings.component.ts')
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
const loginHtml = read('client/src/app/+login/login.component.html')
const gameCommunityRouterTs = read('server/core/controllers/api/games/community.ts')
const communityCommentsTs = read('server/core/controllers/api/games/community-comments.ts')
const gameDiscoveryServerTs = read('server/core/controllers/api/games/game-discovery.ts')
const databaseTs = read('server/core/initializers/database.ts')
const openapiTs = read('support/doc/api/openapi.yaml')
const gameShareControllerTs = read('server/core/controllers/api/games/game-share.ts')
const analyticsTs = read('client/src/app/+games/game-analytics-dashboard.component.ts')
const reserveTs = read('client/src/app/+games/game-reserve-button.component.ts')
const uploadHtml = read('client/src/app/+games/game-upload.component.html')
const uploadTs = read('client/src/app/+games/game-upload.component.ts')
const previewProbeTs = read('client/src/app/+games/services/game-preview-probe.service.ts')
const gameRuntimeTs = read('server/core/controllers/api/games/runtime.ts')
const libraryHtml = read('client/src/app/+games/game-library.component.html')
const libraryTs = read('client/src/app/+games/game-library.component.ts')
const libraryScss = read('client/src/app/+games/game-library.component.scss')
const manageHtml = read('client/src/app/+games/game-manage.component.html')
const manageTs = read('client/src/app/+games/game-manage.component.ts')
const gamesServiceTs = read('client/src/app/+games/games.service.ts')
const clientPackageJson = JSON.parse(read('client/package.json'))
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
assert(/\.game-discuss-panel\s*\{\s*background: #fff;/.test(discussTs), 'discussion panel and its body must use a white surface')
assert(discussTs.includes('wechat-time-separator') && discussStoreTs.includes('shouldShowTime'), 'discussion timestamps must group messages within ten minutes')
assert(
  discussTs.includes('[disabled]="!store.draft().trim() || store.submitting()"') &&
    /\.discuss-composer button:disabled\s*\{/.test(discussTs),
  'discussion send button must be disabled and gray for empty text or an in-flight request'
)
assert(/\.wechat-message\.own \.wechat-bubble\s*\{[\s\S]*background: #9df29f;[\s\S]*color: #303133;/.test(discussTs), 'own discussion messages must use the picked light green background with black text')
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
assert(!communityPanelTs.includes('description-rating') && !communityPanelTs.includes('reviewScores'), 'game description must not expose star rating UI')
assert(!commentsTs.includes('评分') && !commentsTs.includes('review'), 'comments must be text-only and must not expose rating controls')
assert(!gamePlayHtml.includes('game-title-score'), 'game title must not expose a rating score')
assert(gamePlayHtml.includes('class="game-stage-row"'), 'game play must share a row between the game stage and discussion sidebar')
assert(gamePlayHtml.includes('game-title-developer'), 'developer information must stay in the title row above the discussion sidebar')
assert(gamePlayHtml.includes('class="developer-title"'), 'developer card must show the game title below the developer name')
assert(!gamePlayHtml.includes('author.handle'), 'developer card must not render the account handle')
assert(gamePlayHtml.includes('[disabled]="community()!.isOwner"'), 'developer card must keep a visible follow button for the owner view')
assert(gamePlayScss.includes('.game-stage-row'), 'game play must define the aligned stage and discussion row')
assert(gamePlayScss.includes('.play-side my-game-discuss'), 'discussion sidebar must define its own stage-height region')
assert(gamePlayScss.includes('border: 0;') && gamePlayScss.includes('.developer-identity img'), 'developer avatar must render without a border')
assert(gamePlayScss.includes('--game-detail-gap: 16px'), 'game play must define the shared detail-page spacing rhythm')
assert(gamePlayScss.includes('--game-detail-columns: minmax(0, 4fr) minmax(240px, 1fr)'), 'game play must keep a shared 4:1 stage/sidebar layout')
assert(gamePlayScss.includes('aspect-ratio: 16 / 9'), 'game stage must use a stable 16:9 layout ratio')
assert(gamePlayScss.includes('box-sizing: border-box'), 'game detail layout must use border-box sizing for aligned dimensions')
assert(!playHtml.includes(' 游玩</span>') && !playHtml.includes(' 评论</span>'), 'game title metadata must keep the compact icon-number format')
assert(!communityPanelTs.includes('<small>点赞</small>') && !communityPanelTs.includes('<small>投币</small>'), 'game actions must not add a second text row under each icon')
assert(communityPanelTs.includes('align-items: center') && communityPanelTs.includes('height: 1.125rem') && communityPanelTs.includes('width: 1.125rem'), 'game action icons and numbers must share a compact centered baseline')
assert(communityPanelTs.includes('game-description-tabs') && communityPanelTs.includes('操作') && communityPanelTs.includes('game?.instructions'), 'game description must expose separate overview and controls tabs')
assert(communityPanelTs.includes('border-top: 0;') && communityPanelTs.includes('margin-top: 0;'), 'game description must not add a duplicate divider above the content')
assert(discussTs.includes('min-height: 36px') && !discussTs.includes('实时交流'), 'discussion header must be compact and show only the discussion title')
assert(gamePlayScss.includes('background: #fff;') && gamePlayScss.includes('min-height: 28px'), 'developer follow button must use a compact white style')
assert(gameCommunityTokens.includes('--game-text: #303133') && gameCommunityTokens.includes('--game-muted: #6b6f75'), 'game colors must use softened charcoal primary and gray secondary text')
assert(gamePlayScss.includes('--game-text: #303133') && gamePlayScss.includes('--game-muted: #6b6f75'), 'detail page must apply its charcoal palette within the component scope')
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
assert(reserveTs.includes('iconName="bell"') && reserveTs.includes('iconName="tick"') && !reserveTs.includes('🔔') && !reserveTs.includes('✓'), 'game reservation states must use shared library icons instead of emoji glyphs')
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
assert(/\.wechat-bubble\s*\{[\s\S]*background: #eeeef0;[\s\S]*color: #303133;/.test(discussTs), 'other discussion messages must use the picked light gray background with black text')
assert(/\.wechat-message\.own \.wechat-bubble\s*\{[\s\S]*background: #9df29f;[\s\S]*color: #303133;/.test(discussTs), 'own discussion messages must use the picked light green background with black text')
assert(gamePlayScss.includes('width: 90%;') && !gamePlayScss.includes('max-width: 1280px;'), 'detail page must follow the homepage 5 percent side spacing without a narrower desktop cap')
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
  !gamePlayHtml.includes('举报') && !gamePlayHtml.includes('my-game-report-dialog') &&
    !gamePlayTs.includes('GameReportDialogComponent') && !gamePlayTs.includes('reportOpen') &&
    !gamePlayTs.includes('openReportDialog') && !gamePlayScss.includes('.report-trigger-btn'),
  'game play must not expose the removed report feature'
)
assert(
  ![ uploadHtml, uploadTs, libraryHtml, libraryTs, libraryScss, manageHtml, manageTs, gamesServiceTs ].some(body =>
    body.includes('下载游戏包') || body.includes('buildDownloadUrl') || body.includes('library-download')
  ),
  'GameHub must not expose game download actions or download URL helpers'
)
assert(gamePlayScss.includes('background: rgb(0 0 0 / 68%)') && gamePlayScss.includes('opacity: 0;') && gamePlayScss.includes('.game-stage:hover .game-player-controls'), 'game controls must be a hidden translucent overlay revealed on stage hover')
assert(commentsTs.includes('bili-composer-tool') && commentsTs.includes('accept="image/*"') && commentsTs.includes('添加表情'), 'comment composer must expose emoji and image controls')
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
    /\.game-description-content\s*\{[\s\S]*display: flex;[\s\S]*flex-direction: column;[\s\S]*height: 200px;[\s\S]*max-height: 200px;[\s\S]*min-height: 200px;[\s\S]*overflow-y: auto;/.test(communityPanelTs) &&
    communityPanelTs.includes('min-height: 200px;') &&
    /\.game-description-fallback\s*\{[\s\S]*height: 200px;[\s\S]*max-height: 200px;[\s\S]*min-height: 200px;[\s\S]*overflow-y: auto;/.test(communityPanelTs),
  'game overview and controls must share a fixed 200px content area, including fallback state'
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
  previewProbeTs.includes('private prepareGeneration = 0') &&
    previewProbeTs.includes('const generation = ++this.prepareGeneration') &&
    previewProbeTs.includes('if (generation !== this.prepareGeneration) return'),
  'game upload preview must ignore stale async file preparation results'
)
assert(
  previewProbeTs.includes('replace(/<\\/body>/i') && gameRuntimeTs.includes('replace(/<\\/body>/i'),
  'game preview probes must inject before case-insensitive closing body tags'
)
assert(
  previewProbeTs.includes('URL.revokeObjectURL(this.objectUrl)') &&
    previewProbeTs.includes('this.previewUrl.set(null)') &&
    previewProbeTs.includes('this.onComplete = undefined'),
  'game upload preview must revoke object URLs and clear callbacks when reset'
)
assert(uploadHtml.includes('(load)="onPreviewLoaded($event)"') && uploadTs.includes('onPreviewLoaded (event: Event)'), 'game upload preview must ignore stale iframe load events')
assert(!uploadHtml.includes('class="upload-preview-frame"') || !uploadHtml.includes('loading="lazy"'), 'game upload preview iframe must load eagerly so safety checks cannot be skipped off-screen')
assert(
  uploadTs.includes('private previewGeneration = 0') &&
    uploadTs.includes('this.previewGeneration += 1') &&
    uploadTs.includes('finishPreview(screenshot, generation)') &&
    uploadTs.includes('generation !== this.previewGeneration'),
  'game upload cover generation must ignore stale file lifecycle results'
)
assert(
  uploadTs.includes('this.coverGenerator.coverPreview.set(\'\')') &&
    uploadTs.includes('this.coverGenerator.coverSource.set(\'generated\')') &&
    uploadTs.includes('this.coverGenerator.coverSource() === \'manual\''),
  'game upload must clear cross-page cover state and preserve a manually selected cover'
)
assert(
  /onCoverChange \(event: Event\) \{[\s\S]*const cover = \(event\.target as HTMLInputElement\)\.files\?\.\[0\] \|\| null[\s\S]*if \(!cover\) \{[\s\S]*this\.coverGenerator\.coverSource\.set\(\'generated\'\)[\s\S]*this\.coverGenerator\.setCoverPreview\(null\)[\s\S]*return/.test(uploadTs),
  'clearing an optional manual cover must restore automatic cover state'
)
assert(
  previewProbeTs.includes('private previewReady = false') &&
    previewProbeTs.includes('if (!this.previewReady) return') &&
    previewProbeTs.includes('this.previewReady = true'),
  'game upload preview must ignore iframe load events while a new file is still preparing'
)
assert(
  uploadTs.includes('readonly previewValidationError = this.previewProbe.error') &&
    uploadHtml.includes('{{ previewValidationError() }}') &&
    uploadHtml.includes('[disabled]="submitting() || !file || !!previewValidationError()"'),
  'game upload must expose preview validation errors and block submission until they are fixed'
)
assert(
  uploadTs.includes('private prepareSelectedFile (file: File | null)') &&
    uploadTs.includes('this.resetForNewFile()') &&
    uploadTs.includes('this.fileSize.set(file?.size || 0)') &&
    uploadTs.includes('this.previewProbe.reset()'),
  'game upload must clear the previous preview and cover before validating a newly selected file'
)
assert(
  uploadTs.includes('private hasUnsavedChanges ()') &&
    uploadTs.includes('if (!this.hasUnsavedChanges()) return') &&
    uploadTs.includes('this.submitting() || this.createdGame()'),
  'game upload must warn only when there are actual unsaved fields or a file submission in progress'
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
assert(!loginHtml.includes('上传、编辑和下载'), 'login page must not promise game downloads')
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
    headerScss.includes('.game-preview-cover') &&
    /\.game-preview-cover[\s\S]*height: 2\.85rem;[\s\S]*width: 5\.1rem;/.test(headerScss),
  'header game popover covers must use a fixed thumbnail box and recover after image failures'
)
assert(
  headerHtml.includes('(pointerenter)="scheduleGameAvatarMenu()"') &&
    headerHtml.includes('(pointerleave)="cancelGameAvatarHover()"') &&
    !headerHtml.includes('(mouseenter)="scheduleGameAvatarMenu()"') &&
    !headerHtml.includes('(mouseleave)="cancelGameAvatarHover()"'),
  'header avatar hover must use one pointer-event path without duplicate mouse handlers'
)
for (const popup of [ 'notifications', 'favorites', 'history', 'creator' ]) {
  assert(
    headerHtml.includes(`(pointerenter)="scheduleGameNavHover('${popup}')"`) &&
      headerHtml.includes('(pointerleave)="cancelGameNavHover()"') &&
      !headerHtml.includes(`(mouseenter)="scheduleGameNavHover('${popup}')"`) &&
      !headerHtml.includes('(mouseleave)="cancelGameNavHover()"'),
    `header ${popup} hover entry must use one pointer-event path without duplicate mouse handlers`
  )
}
const gameNavPopoverSections = headerHtml.match(/<section\b[^>]*game-header-popover[^>]*>/g) || []
assert(
  gameNavPopoverSections.length >= 4 &&
    gameNavPopoverSections.every(section =>
      section.includes('(pointerenter)="retainGameNavHover()"') &&
      section.includes('(pointerleave)="cancelGameNavHover()"') &&
      !section.includes('(mouseenter)="retainGameNavHover()"') &&
      !section.includes('(mouseleave)="cancelGameNavHover()"')
    ),
  'header hover popovers must retain through one pointer-event path without duplicate handlers'
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
  !headerScss.includes('background: #eaf8ff;') &&
    /\.game-header-actions a\.game-header-action-active \{[\s\S]*background: transparent;[\s\S]*color: var\(--game-header-nav-foreground, var\(--game-text-secondary\)\) !important;/.test(headerScss) &&
    /\.game-header-left-nav a\.active \{[\s\S]*background: transparent;[\s\S]*color: var\(--game-header-nav-foreground, var\(--game-text-secondary\)\) !important;/.test(headerScss),
  'GameHub navigation must keep a transparent selected and hover state while only animating the icon'
)
assert(
  headerScss.includes("url('../../assets/images/gamehub-header-banner-10x1.png')") &&
    headerScss.includes('background-size: auto var(--game-header-expanded-height);') &&
    headerScss.includes('background-position: center top;') &&
    headerScss.includes('height: var(--header-height);') &&
    appScss.includes('--header-height: 200px;') &&
    appScss.includes('--header-height: 50px;') &&
    gamesHomeScss.includes('top: var(--header-height);'),
  'GameHub desktop header must show the fixed-ratio 200px banner, collapse to 50px after scrolling, and keep the discovery nav below it'
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
    gamePlayScss.includes('flex: 0 0 var(--game-stage-height);'),
  'detail sidebar must grow with recommendations while keeping the discussion panel at stage height'
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
  featuredHtml.includes('[style.background]="featuredCoverFade(featuredGame)"'),
  'featured carousel must bind the average-color fade to the cover'
)
assert(
  featuredHtml.includes('[style.background]="featuredAvgColor(featuredGame)"'),
  'featured carousel footer must bind the calculated five-segment average-color gradient'
)
assert(
  featuredScss.includes('background-color: #8f6a51'),
  'featured carousel footer must use the calculated brown placeholder fallback instead of black'
)
assert(
  !featuredScss.includes('background-color: #1e1e1e'),
  'featured carousel footer must not use the dark global text color as its fallback'
)

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

  const builtJs = collectFiles(join(root, 'client/dist/browser'), '.js')
  const builtBodies = builtJs.map(file => readFileSync(file, 'utf8'))
  for (const [index, body] of builtBodies.entries()) {
    assertBundleContract(body, `built bundle ${builtJs[index]}`)
  }
  assert(
    builtBodies.some(body => body.includes('replace(/,\\s*/g')),
    'built bundles must contain the RGB normalization used by the carousel fade'
  )
}

const gamehubPaletteSources = [
  appScss,
  headerScss,
  gameCommunityTokens,
  gamesHomeScss,
  gamePlayScss,
  discussTs,
  commentsTs,
  featuredScss,
  gameSectionTs
].join('\n')
assert(
  appScss.includes('--game-text: #303133') &&
    appScss.includes('--game-text-button: #646464') &&
    appScss.includes('--game-text-hint: #8c8c8c') &&
    headerScss.includes('--game-text-primary: #303133') &&
    headerScss.includes('--game-text-secondary: #646464') &&
    gameCommunityTokens.includes('--game-muted: #646464'),
  'GameHub shared palette must use #303133 primary, #646464 secondary, and #8c8c8c hint text'
)
assert(
  !/(#4e5969|#61666d|#6b6f75|#9499a0)/i.test(gamehubPaletteSources),
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
    let liveBundleHasRgbNormalization = false

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
      if (body.includes('replace(/,\\s*/g')) liveBundleHasRgbNormalization = true

      for (const match of body.matchAll(/(?:from|import\()\s*["'](\.\/[^"']+\.js)["']/g)) {
        pendingScripts.push(new URL(match[1], absUrl).href)
      }
      console.log(`live script OK ${absUrl} CT=${ct}`)
    }

    assert(liveBundleHasRgbNormalization, 'live bundles must include the RGB normalization used by the carousel fade')

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
console.log(' - light build forces /client/en-US/ base href')
if (existsSync(join(root, 'client/dist/browser'))) {
  console.log(' - client dist layout + SPA script disk paths')
  for (const p of resolvedScriptPaths) console.log(`   script ${p}`)
}
if (verifyBase) {
  console.log(` - live SPA scripts under ${verifyBase} are application/javascript`)
}
