import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core'
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
import { GameErrorRetryComponent } from './shared'
import { FeaturedCarouselComponent } from './games-home/featured-carousel.component'
import { GameSectionComponent } from './games-home/game-section.component'
import { HOME_CATEGORIES } from './games-home.constants'

@Component({
  templateUrl: './games-home.component.html',
  styleUrl: './games-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    GameCardComponent, GameSkeletonComponent, GlobalIconComponent, RouterLink,
    GameErrorRetryComponent, FeaturedCarouselComponent, GameSectionComponent
  ]
})
export class GamesHomeComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  private readonly authService = inject(AuthService)
  private readonly route = inject(ActivatedRoute)
  private readonly http = inject(HttpClient)
  private readonly recommendService = inject(GameRecommendService)

  readonly latest = signal<Game[]>([])
  readonly popular = signal<Game[]>([])
  readonly recent = signal<Game[]>([])
  readonly recommended = signal<Game[]>([])
  readonly featured = signal<Game[]>([])
  readonly collections = signal<{ id: number; title: string; slug: string; coverPath: string | null; gameCount: number }[]>([])
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
  private requestGeneration = 0

  readonly categories = HOME_CATEGORIES

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
      const validSorts = [ 'recommended', 'latest', 'popular' ]
      this.sort.set(validSorts.includes(requestedSort || '') ? requestedSort : 'recommended')
      this.recommendedOffset.set(0)
      this.loadGames()
    })
  }

  loadGames () {
    const generation = ++this.requestGeneration
    this.loadingMore.set(false)

    if (this.communityRoute()) {
      this.latest.set([])
      this.popular.set([])
      this.recent.set([])
      this.recommended.set([])
      this.loading.set(false)
      return
    }

    if (this.view() === 'categories') {
      this.latest.set([])
      this.popular.set([])
      this.recent.set([])
      this.recommended.set([])
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
          if (!this.isCurrentRequest(generation)) return
          this.recommended.set(result.data)
          this.recommendedTotal.set(result.total)
          this.popular.set([])
          this.latest.set([])
          this.recent.set([])
          this.loading.set(false)
        },
        error: () => {
          if (!this.isCurrentRequest(generation)) return
          this.error.set('加载失败，请稍后重试')
          this.loading.set(false)
        }
      })
      return
    }

    if (this.searchMode() && this.sort() === 'recommended') {
      this.gamesService.list({ ...common, sort: 'recommended' }).subscribe({
        next: result => {
          if (!this.isCurrentRequest(generation)) return
          this.recommended.set(result.data)
          this.recommendedTotal.set(result.total)
          this.popular.set([])
          this.latest.set([])
          this.recent.set([])
          this.loading.set(false)
        },
        error: () => {
          if (!this.isCurrentRequest(generation)) return
          this.error.set('加载失败，请稍后重试')
          this.loading.set(false)
        }
      })
      return
    }

    if (this.sort() !== 'recommended') {
      this.gamesService.list({ ...common, sort: this.sort() }).subscribe({
        next: result => {
          if (!this.isCurrentRequest(generation)) return
          this.recommended.set(result.data)
          this.recommendedTotal.set(result.total)
          this.popular.set([])
          this.latest.set([])
          this.recent.set([])
          this.loading.set(false)
        },
        error: () => {
          if (!this.isCurrentRequest(generation)) return
          this.error.set('加载失败，请稍后重试')
          this.loading.set(false)
        }
      })
      return
    }

    if (this.category()) {
      this.gamesService.list({ ...common, count: 16, sort: 'popular' }).subscribe({
        next: result => {
          if (!this.isCurrentRequest(generation)) return
          this.recommended.set(result.data)
          this.recommendedTotal.set(result.total)
          this.popular.set([])
          this.latest.set([])
          this.recent.set([])
          this.loading.set(false)
        },
        error: () => {
          if (!this.isCurrentRequest(generation)) return
          this.error.set('加载失败，请稍后重试')
          this.loading.set(false)
        }
      })
      return
    }

    forkJoin({
      latest: this.gamesService.list({ ...common, count: 5, sort: 'latest' }).pipe(
        catchError(() => of({ total: 0, data: [] as Game[] }))
      ),
      popular: this.gamesService.list({ ...common, count: 10, sort: 'popular' }).pipe(
        catchError(() => of({ total: 0, data: [] as Game[] }))
      ),
      recent: this.authService.isLoggedIn()
        ? this.gamesService.listRecent().pipe(catchError(() => of({ total: 0, data: [] as Game[] })))
        : of({ total: 0, data: [] as Game[] }),
      recommended: this.gamesService.list({ ...common, sort: 'recommended', start: this.recommendedOffset() }),
      featured: this.gamesService.getFeaturedGames(6).pipe(
        catchError(() => of({ total: 0, data: [] as Game[] }))
      ),
      collections: this.http.get<{
        total: number
        data: { id: number; title: string; slug: string; coverPath: string | null; gameCount: number }[]
      }>(`${environment.apiUrl}/api/v1/games/collections`).pipe(
        catchError(() => of({ total: 0, data: [] }))
      )
    }).subscribe({
      next: result => {
        if (!this.isCurrentRequest(generation)) return
        this.latest.set(result.latest.data)
        this.popular.set(result.popular.data)
        this.recommended.set(result.recommended.data)
        this.featured.set(result.featured.data)
        this.collections.set(result.collections.data)
        // Prefer server recent plays; fall back to local browse history for guests
        const allGames = [
          ...result.recent.data,
          ...result.latest.data,
          ...result.popular.data,
          ...result.recommended.data,
          ...result.featured.data
        ]
        this.recent.set(this.buildRecentPlayedList(result.recent.data, allGames))
        this.recommendedTotal.set(result.recommended.total)
        this.loading.set(false)
      },
      error: () => {
        if (!this.isCurrentRequest(generation)) return
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

  loadMoreRecommended () {
    if (this.loadingMore() || this.loading()) return
    const total = this.recommendedTotal()
    const current = this.recommended().length
    if (current >= total) return

    this.loadingMore.set(true)
    const generation = this.requestGeneration
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
        if (!this.isCurrentRequest(generation)) return
        this.recommended.update(prev => [ ...prev, ...result.data ])
        this.recommendedTotal.set(result.total)
        this.loadingMore.set(false)
      },
      error: () => {
        if (!this.isCurrentRequest(generation)) return
        this.loadingMore.set(false)
      }
    })
  }

  hasMoreToLoad () {
    return this.recommended().length < this.recommendedTotal()
  }

  private isCurrentRequest (generation: number) {
    return generation === this.requestGeneration
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

  onPublishedAfterChange (event: Event) {
    this.publishedAfter.set((event.target as HTMLInputElement).value)
    this.loadGames()
  }

  primaryHeading () {
    if (this.view() === 'following') return '关注动态'
    if (this.searchMode() || this.search() || this.category() || this.publishedAfter()) return '搜索结果'

    const headings: Record<string, string> = {
      recommended: '为你推荐',
      popular: '正在热门',
      latest: '最新发布'
    }
    return headings[this.sort()] || '为你推荐'
  }

  categoryTitle () {
    return this.categories.find(item => item.id === this.category())?.title || '游戏'
  }
}
