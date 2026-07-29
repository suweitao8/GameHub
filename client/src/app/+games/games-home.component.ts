import { afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, OnDestroy, OnInit, signal } from '@angular/core'
import { AuthService } from '@app/core/auth/auth.service'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { forkJoin, of } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { GameCardComponent } from './game-card.component'
import { GameSkeletonComponent } from './game-skeleton.component'
import { GamesService, Game } from './games.service'
import { GamesListParams } from './games-api'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { HttpClient } from '@angular/common/http'
import { GameRecommendService } from './game-recommend.service'
import { environment } from '../../environments/environment'
import { GameErrorRetryComponent, GameEmptyStateComponent } from './shared'

@Component({
  templateUrl: './games-home.component.html',
  styleUrl: './games-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GameCardComponent, GameSkeletonComponent, GlobalIconComponent, RouterLink, GameErrorRetryComponent, GameEmptyStateComponent ]
})
export class GamesHomeComponent implements OnDestroy, OnInit {
  private readonly gamesService = inject(GamesService)
  private readonly authService = inject(AuthService)
  private readonly route = inject(ActivatedRoute)
  private readonly http = inject(HttpClient)
  private readonly recommendService = inject(GameRecommendService)
  private readonly host = inject(ElementRef<HTMLElement>)

  readonly latest = signal<Game[]>([])
  readonly popular = signal<Game[]>([])
  readonly recent = signal<Game[]>([])
  readonly recommended = signal<Game[]>([])
  readonly loading = signal(true)
  /** 错误消息（空字符串 = 无错误），与 createAsyncState 规范一致 */
  readonly error = signal('')
  readonly hasError = computed(() => this.error().length > 0)
  readonly search = signal('')
  readonly view = signal('')
  readonly searchMode = signal(false)
  readonly category = signal('')
  readonly publishedAfter = signal('')
  readonly communityRoute = signal(false)
  readonly sort = signal<GamesListParams['sort']>('recommended')
  readonly recommendedOffset = signal(0)
  readonly recommendedTotal = signal(0)
  readonly loadingMore = signal(false)
  readonly carouselIndex = signal(0)
  /** Cover average RGB string "r, g, b" for solid caption + fade. */
  readonly featuredAvgColors = signal<Record<string, string>>({})
  readonly featured = signal<Game[]>([])
  readonly collections = signal<{ id: number; title: string; slug: string; coverPath: string | null; gameCount: number }[]>([])
  /** Left carousel height = first full side card + gap + second-row cover. */
  readonly featuredCarouselHeight = signal<number | null>(null)
  /** Cover URLs that failed to load → show colorful placeholder instead of gray empty box. */
  readonly brokenFeaturedCovers = signal<Record<string, true>>({})
  private carouselTimer: ReturnType<typeof setInterval> | undefined
  private featuredResizeObserver: ResizeObserver | undefined
  private featuredSyncFrame = 0
  private readonly featuredFallbackColors = [ '0, 174, 236', '108, 99, 255', '0, 192, 145', '251, 114, 153', '255, 159, 67' ]
  readonly sortKinds = [
    { id: 'recommended' as GamesListParams['sort'], label: '综合' },
    { id: 'latest' as GamesListParams['sort'], label: '最新' },
    { id: 'popular' as GamesListParams['sort'], label: '最热' },
    { id: 'likes' as GamesListParams['sort'], label: '点赞' },
    { id: 'coins' as GamesListParams['sort'], label: '投币' },
    { id: 'favorites' as GamesListParams['sort'], label: '收藏' }
  ]
  readonly categories = [
    { id: 'arcade', title: '动作', description: '快速反应，马上开始一局。', query: { category: 'arcade' } },
    { id: 'adventure', title: '冒险', description: '探索地图，发现隐藏的故事。', query: { category: 'adventure' } },
    { id: 'shooter', title: '射击', description: '瞄准目标，挑战你的反应速度。', query: { category: 'shooter' } },
    { id: 'puzzle', title: '解谜', description: '动动脑筋，找出下一步。', query: { category: 'puzzle' } },
    { id: 'casual', title: '休闲', description: '轻松打开，随时玩一会儿。', query: { category: 'casual' } },
    { id: 'rpg', title: '角色扮演', description: '塑造角色，开启一段新旅程。', query: { category: 'rpg' } },
    { id: 'strategy', title: '策略', description: '规划资源，赢下更大的局。', query: { category: 'strategy' } },
    { id: 'simulation', title: '模拟', description: '在虚拟世界里体验另一种生活。', query: { category: 'simulation' } },
    { id: 'sandbox', title: '沙盒', description: '自由创造，按照自己的方式游玩。', query: { category: 'sandbox' } },
    { id: 'sports', title: '体育', description: '在轻量对局中享受竞技乐趣。', query: { category: 'sports' } },
    { id: 'card', title: '卡牌', description: '组合卡组，做出关键的选择。', query: { category: 'card' } },
    { id: 'music', title: '音乐', description: '跟随节奏，完成一场声音之旅。', query: { category: 'music' } },
    { id: 'horror', title: '恐怖', description: '戴上耳机，探索未知角落。', query: { category: 'horror' } },
    { id: 'board', title: '桌游', description: '熟悉的规则，适合短时游玩。', query: { category: 'board' } }
  ]

  ngOnInit () {
    const routePath = this.route.snapshot.routeConfig?.path
    const isCommunityRoute = routePath === 'community'
    this.communityRoute.set(isCommunityRoute)
    this.searchMode.set(routePath === 'search')
    this.route.queryParamMap.subscribe(params => {
      this.view.set(params.get('view') || (isCommunityRoute ? 'following' : ''))
      this.category.set(params.get('category') || '')
      this.search.set(params.get('search') || '')
      this.publishedAfter.set(params.get('publishedAfter') || '')
      const requestedSort = params.get('sort') as GamesListParams['sort']
      const validSorts = [ 'recommended', 'latest', 'popular', 'likes', 'coins', 'favorites' ]
      this.sort.set(validSorts.includes(requestedSort || '') ? requestedSort : 'recommended')
      this.recommendedOffset.set(0)
      this.loadGames()
    })
    this.startCarousel()
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    afterNextRender(() => this.setupFeaturedCarouselSync())
  }

  ngOnDestroy () {
    if (this.carouselTimer) clearInterval(this.carouselTimer)
    this.teardownFeaturedCarouselSync()
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
  }

  loadGames () {
    if (this.communityRoute()) {
      this.latest.set([])
      this.popular.set([])
      this.recent.set([])
      this.recommended.set([])
      this.carouselIndex.set(0)
      this.loading.set(false)
      return
    }

    if (this.view() === 'categories') {
      this.latest.set([])
      this.popular.set([])
      this.recent.set([])
      this.recommended.set([])
      this.carouselIndex.set(0)
      this.loading.set(false)
      return
    }

    this.loading.set(true)
    this.error.set('')
    const common: GamesListParams = {
      search: this.search() || undefined,
      category: this.category() || undefined,
      publishedAfter: this.publishedAfter() || undefined,
      view: this.view() === 'following' ? 'following' : undefined,
      count: 8
    }

    if (this.view() === 'following') {
      this.gamesService.list({ ...common, sort: 'latest' }).subscribe({
        next: result => {
          this.recommended.set(result.data)
          this.carouselIndex.set(0)
          this.recommendedTotal.set(result.total)
          this.popular.set([])
          this.latest.set([])
          this.recent.set([])
          this.loading.set(false)
        },
        error: () => {
          this.error.set('加载失败，请稍后重试')
          this.loading.set(false)
        }
      })
      return
    }

    if (this.searchMode() && this.sort() === 'recommended') {
      this.gamesService.list({ ...common, sort: 'recommended' }).subscribe({
        next: result => {
          this.recommended.set(result.data)
          this.carouselIndex.set(0)
          this.recommendedTotal.set(result.total)
          this.popular.set([])
          this.latest.set([])
          this.recent.set([])
          this.loading.set(false)
        },
        error: () => {
          this.error.set('加载失败，请稍后重试')
          this.loading.set(false)
        }
      })
      return
    }

    if (this.sort() !== 'recommended') {
      this.gamesService.list({ ...common, sort: this.sort() }).subscribe({
        next: result => {
          this.recommended.set(result.data)
          this.carouselIndex.set(0)
          this.recommendedTotal.set(result.total)
          this.popular.set([])
          this.latest.set([])
          this.recent.set([])
          this.loading.set(false)
        },
        error: () => {
          this.error.set('加载失败，请稍后重试')
          this.loading.set(false)
        }
      })
      return
    }

    if (this.category()) {
      this.gamesService.list({ ...common, count: 16, sort: 'popular' }).subscribe({
        next: result => {
          this.recommended.set(result.data)
          this.carouselIndex.set(0)
          this.recommendedTotal.set(result.total)
          this.popular.set([])
          this.latest.set([])
          this.recent.set([])
          this.loading.set(false)
        },
        error: () => {
          this.error.set('加载失败，请稍后重试')
          this.loading.set(false)
        }
      })
      return
    }

    forkJoin({
      latest: this.gamesService.list({ ...common, count: 5, sort: 'latest' }),
      popular: this.gamesService.list({ ...common, count: 10, sort: 'popular' }),
      recent: this.authService.isLoggedIn()
        ? this.gamesService.listRecent().pipe(catchError(() => of({ total: 0, data: [] as Game[] })))
        : of({ total: 0, data: [] as Game[] }),
      recommended: this.gamesService.list({ ...common, sort: 'recommended', start: this.recommendedOffset() }),
      featured: this.gamesService.getFeaturedGames(6).pipe(catchError(() => of({ total: 0, data: [] as Game[] }))),
      collections: this.http.get<{ total: number; data: { id: number; title: string; slug: string; coverPath: string | null; gameCount: number }[] }>(`${environment.apiUrl}/api/v1/games/collections`).pipe(catchError(() => of({ total: 0, data: [] })))
    }).subscribe({
      next: result => {
        this.latest.set(result.latest.data)
        this.popular.set(result.popular.data)
        this.recommended.set(result.recommended.data)
        this.featured.set(result.featured.data)
        this.collections.set(result.collections.data)
        // Prefer server recent plays; fall back to local browse history for guests
        const allGames = [ ...result.recent.data, ...result.latest.data, ...result.popular.data, ...result.recommended.data, ...result.featured.data ]
        this.recent.set(this.buildRecentPlayedList(result.recent.data, allGames))
        this.carouselIndex.set(0)
        this.recommendedTotal.set(result.recommended.total)
        this.loading.set(false)
        // cards use viewport defer; remeasure after they expand to real height
        this.scheduleFeaturedCarouselSync()
        setTimeout(() => this.scheduleFeaturedCarouselSync(), 120)
        setTimeout(() => this.scheduleFeaturedCarouselSync(), 480)
      },
      error: () => {
        this.error.set('加载失败，请稍后重试')
        this.loading.set(false)
      }
    })
  }

  shuffleRecommendations () {
    const total = this.recommendedTotal()
    const nextOffset = total > 0 && this.recommendedOffset() + 8 >= total
      ? 0
      : this.recommendedOffset() + 8
    this.recommendedOffset.set(nextOffset)
    this.loadGames()
  }

  /**
   * Left banner bottom = bottom of second-row side card covers.
   * height = (one full side card) + row gap + (one cover image height).
   */
  private setupFeaturedCarouselSync () {
    if (typeof ResizeObserver === 'undefined') {
      this.scheduleFeaturedCarouselSync()
      return
    }

    this.featuredResizeObserver = new ResizeObserver(() => this.scheduleFeaturedCarouselSync())
    this.featuredResizeObserver.observe(this.host.nativeElement)
    this.scheduleFeaturedCarouselSync()
  }

  private teardownFeaturedCarouselSync () {
    this.featuredResizeObserver?.disconnect()
    this.featuredResizeObserver = undefined
    if (this.featuredSyncFrame) cancelAnimationFrame(this.featuredSyncFrame)
    this.featuredSyncFrame = 0
  }

  private scheduleFeaturedCarouselSync () {
    if (this.featuredSyncFrame) cancelAnimationFrame(this.featuredSyncFrame)
    this.featuredSyncFrame = requestAnimationFrame(() => {
      this.featuredSyncFrame = 0
      this.syncFeaturedCarouselHeight()
    })
  }

  private syncFeaturedCarouselHeight () {
    const root = this.host.nativeElement
    const side = root.querySelector('.featured-side-grid') as HTMLElement | null
    const cards = side?.querySelectorAll<HTMLElement>('.game-card')
    if (!side || !cards?.length) {
      this.featuredCarouselHeight.set(null)
      return
    }

    const firstCard = cards[0]
    const cover = firstCard.querySelector('.game-cover') as HTMLElement | null
    if (this.featuredResizeObserver) {
      this.featuredResizeObserver.observe(side)
      this.featuredResizeObserver.observe(firstCard)
      if (cover) this.featuredResizeObserver.observe(cover)
    }
    if (!cover || firstCard.offsetHeight <= 0 || cover.offsetHeight <= 0) {
      this.featuredCarouselHeight.set(null)
      return
    }

    const styles = getComputedStyle(side)
    const gap = Number.parseFloat(styles.rowGap || styles.gap || '0') || 0
    // full first card (image + text) + gap + second-row cover only
    const height = Math.round(firstCard.offsetHeight + gap + cover.offsetHeight)
    if (height > 0 && this.featuredCarouselHeight() !== height) {
      this.featuredCarouselHeight.set(height)
    }
  }

  loadMoreRecommended () {
    if (this.loadingMore() || this.loading()) return
    const total = this.recommendedTotal()
    const current = this.recommended().length
    if (current >= total) return

    this.loadingMore.set(true)
    const common: GamesListParams = {
      search: this.search() || undefined,
      category: this.category() || undefined,
      publishedAfter: this.publishedAfter() || undefined,
      view: this.view() === 'following' ? 'following' : undefined,
      count: 8,
      sort: this.sort(),
      start: current
    }
    this.gamesService.list(common).subscribe({
      next: result => {
        this.recommended.update(prev => [...prev, ...result.data])
        this.recommendedTotal.set(result.total)
        this.loadingMore.set(false)
      },
      error: () => this.loadingMore.set(false)
    })
  }

  hasMoreToLoad () {
    return this.recommended().length < this.recommendedTotal()
  }

  shufflePopular () {
    this.popular.update(games => games.length > 1 ? [ ...games.slice(1), games[0] ] : games)
  }

  shuffleLatest () {
    this.latest.update(games => games.length > 1 ? [ ...games.slice(1), games[0] ] : games)
  }

  shuffleRecent () {
    this.recent.update(games => games.length > 1 ? [ ...games.slice(1), games[0] ] : games)
  }

  private buildRecentPlayedList (serverRecent: Game[], pool: Game[]) {
    if (serverRecent.length) {
      return this.uniqueGamesByUuid(serverRecent)
    }

    const history = this.recommendService.getHistory()
    if (!history.length) return []

    const byUuid = new Map(this.uniqueGamesByUuid(pool).map(game => [ game.uuid, game ]))
    const fromHistory: Game[] = []
    for (const item of history) {
      const game = byUuid.get(item.uuid)
      if (game) fromHistory.push(game)
    }
    return fromHistory
  }

  private uniqueGamesByUuid (games: Game[]) {
    const seen = new Set<string>()
    const unique: Game[] = []
    for (const game of games) {
      if (seen.has(game.uuid)) continue
      seen.add(game.uuid)
      unique.push(game)
    }
    return unique
  }

  carouselGames () {
    return this.recommended().slice(0, 6)
  }

  carouselGame () {
    const games = this.carouselGames()
    return games.length ? games[this.carouselIndex() % games.length] : null
  }

  featuredCoverPath (game: Game) {
    if (!game.coverPath || this.brokenFeaturedCovers()[game.uuid]) return null
    return game.coverPath
  }

  onFeaturedCoverError (uuid: string) {
    if (this.brokenFeaturedCovers()[uuid]) return
    this.brokenFeaturedCovers.update(map => ({ ...map, [uuid]: true }))
  }

  /** Solid average color of the full cover (fallback seeded palette). */
  featuredAvgColor (game: Game) {
    const stored = this.featuredAvgColors()[game.uuid]
    if (stored) return `rgb(${stored})`
    return `rgb(${this.fallbackAvgRgb(game.uuid)})`
  }

  /** Bottom 1/6 of cover: same pure color with opacity fade (like game-card meta). */
  featuredCoverFade (game: Game) {
    const rgb = this.featuredAvgColors()[game.uuid] || this.fallbackAvgRgb(game.uuid)
    return `linear-gradient(180deg, rgb(${rgb} / 0%) 0%, rgb(${rgb} / 72%) 100%)`
  }

  private fallbackAvgRgb (uuid: string) {
    const seed = Array.from(uuid || 'G').reduce((total, character) => total + character.charCodeAt(0), 0)
    return this.featuredFallbackColors[seed % this.featuredFallbackColors.length]
  }

  onFeaturedImageLoad (event: Event, uuid: string) {
    if (this.featuredAvgColors()[uuid]) return

    const image = event.target as HTMLImageElement
    if (!image.naturalWidth || !image.naturalHeight) return

    try {
      const canvas = document.createElement('canvas')
      // Downsample whole cover for average color
      canvas.width = 32
      canvas.height = 32
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return

      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      let red = 0
      let green = 0
      let blue = 0
      let count = 0

      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] < 128) continue
        red += pixels[index]
        green += pixels[index + 1]
        blue += pixels[index + 2]
        count++
      }

      if (!count) return
      const avg = `${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)}`
      this.featuredAvgColors.update(map => ({ ...map, [uuid]: avg }))
    } catch {
      // Cross-origin cover images may not be readable by canvas; use the fallback palette.
    }
  }

  nextCarousel (step = 1) {
    const total = this.carouselGames().length
    if (!total) return
    this.carouselIndex.set((this.carouselIndex() + step + total) % total)
  }

  onSortChange (event: Event) {
    const sort = (event.target as HTMLSelectElement).value as GamesListParams['sort']
    this.sort.set(sort || 'recommended')
    this.loadGames()
  }

  onSortPill (sort: GamesListParams['sort']) {
    if (this.sort() === sort) return
    this.sort.set(sort)
    this.loadGames()
  }

  sortLabel () {
    const labels: Record<string, string> = {
      recommended: '综合排序',
      latest: '最新发布',
      popular: '最多游玩',
      likes: '最多点赞',
      coins: '最多投币',
      favorites: '最多收藏'
    }
    return labels[this.sort()] || '排序'
  }

  onPublishedAfterChange (event: Event) {
    this.publishedAfter.set((event.target as HTMLInputElement).value)
    this.loadGames()
  }

  primaryHeading () {
    if (this.view() === 'following') return '关注动态'
    if (this.searchMode() || this.search() || this.category() || this.publishedAfter()) return '搜索结果'

    return {
      recommended: '为你推荐',
      popular: '正在热门',
      latest: '最新发布',
      updated: '最近更新',
      likes: '最多点赞',
      coins: '最多投币',
      favorites: '最多收藏'
    }[this.sort()]
  }

  categoryTitle () {
    return this.categories.find(item => item.id === this.category())?.title || '游戏'
  }

  private carouselTouchStartX = 0
  private carouselTouchStartY = 0
  private readonly carouselSwipeThreshold = 50

  onCarouselTouchStart (event: TouchEvent) {
    this.carouselTouchStartX = event.changedTouches[0].screenX
    this.carouselTouchStartY = event.changedTouches[0].screenY
  }

  onCarouselTouchEnd (event: TouchEvent) {
    const endX = event.changedTouches[0].screenX
    const endY = event.changedTouches[0].screenY
    const deltaX = endX - this.carouselTouchStartX
    const deltaY = endY - this.carouselTouchStartY

    // Ignore if vertical scroll is dominant
    if (Math.abs(deltaY) > Math.abs(deltaX)) return

    if (Math.abs(deltaX) > this.carouselSwipeThreshold) {
      this.nextCarousel(deltaX < 0 ? 1 : -1)
    }
  }

  private startCarousel () {
    if (this.carouselTimer) clearInterval(this.carouselTimer)
    this.carouselTimer = setInterval(() => this.nextCarousel(), 6000)
  }

  private onVisibilityChange = () => {
    if (this.carouselTimer) clearInterval(this.carouselTimer)
    if (!document.hidden) this.startCarousel()
  }
}
