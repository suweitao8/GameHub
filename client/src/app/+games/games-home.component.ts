import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core'
import { AuthService } from '@app/core/auth/auth.service'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { forkJoin, of } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { GameCardComponent } from './game-card.component'
import { GameSkeletonComponent } from './game-skeleton.component'
import { GamesService, Game } from './games.service'
import { GamesListParams } from './games-api'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

@Component({
  templateUrl: './games-home.component.html',
  styleUrl: './games-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GameCardComponent, GameSkeletonComponent, GlobalIconComponent, RouterLink ]
})
export class GamesHomeComponent implements OnDestroy, OnInit {
  private readonly gamesService = inject(GamesService)
  private readonly authService = inject(AuthService)
  private readonly route = inject(ActivatedRoute)

  readonly latest = signal<Game[]>([])
  readonly popular = signal<Game[]>([])
  readonly recent = signal<Game[]>([])
  readonly recommended = signal<Game[]>([])
  readonly loading = signal(true)
  readonly error = signal(false)
  readonly search = signal('')
  readonly view = signal('')
  readonly searchMode = signal(false)
  readonly category = signal('')
  readonly publishedAfter = signal('')
  readonly communityRoute = signal(false)
  readonly sort = signal<GamesListParams['sort']>('recommended')
  readonly recommendedOffset = signal(0)
  readonly recommendedTotal = signal(0)
  readonly carouselIndex = signal(0)
  readonly featuredGradients = signal<Record<string, string>>({})
  private carouselTimer: ReturnType<typeof setInterval> | undefined
  private readonly featuredFallbackColors = [ '#00aeec', '#6c63ff', '#00c091', '#fb7299', '#ff9f43' ]
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
    { id: 'racing', title: '竞速', description: '踩下油门，刷新你的最快记录。', query: { category: 'racing' } },
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
  }

  ngOnDestroy () {
    if (this.carouselTimer) clearInterval(this.carouselTimer)
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
    this.error.set(false)
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
          this.error.set(true)
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
          this.error.set(true)
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
          this.error.set(true)
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
          this.error.set(true)
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
      recommended: this.gamesService.list({ ...common, sort: 'recommended', start: this.recommendedOffset() })
    }).subscribe({
      next: result => {
        this.latest.set(result.latest.data)
        this.popular.set(result.popular.data)
        this.recent.set(result.recent.data)
        this.recommended.set(result.recommended.data)
        this.carouselIndex.set(0)
        this.recommendedTotal.set(result.recommended.total)
        this.loading.set(false)
      },
      error: () => {
        this.error.set(true)
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

  shufflePopular () {
    this.popular.update(games => games.length > 1 ? [ ...games.slice(1), games[0] ] : games)
  }

  shuffleLatest () {
    this.latest.update(games => games.length > 1 ? [ ...games.slice(1), games[0] ] : games)
  }

  carouselGames () {
    return this.recommended().slice(0, 6)
  }

  carouselGame () {
    const games = this.carouselGames()
    return games.length ? games[this.carouselIndex() % games.length] : null
  }

  featuredGradient (game: Game) {
    const storedGradient = this.featuredGradients()[game.uuid]
    if (storedGradient) return storedGradient

    const seed = Array.from(game.uuid).reduce((total, character) => total + character.charCodeAt(0), 0)
    const fallback = this.featuredFallbackColors[seed % this.featuredFallbackColors.length]
    return `linear-gradient(90deg, ${fallback} 0%, ${fallback} 100%)`
  }

  onFeaturedImageLoad (event: Event, uuid: string) {
    if (this.featuredGradients()[uuid]) return

    const image = event.target as HTMLImageElement
    if (!image.naturalWidth || !image.naturalHeight) return

    try {
      const canvas = document.createElement('canvas')
      // Only sample the bottom tenth: it is the part visually adjacent to the title.
      canvas.width = 50
      canvas.height = 10
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return

      context.drawImage(
        image, 0, image.naturalHeight * 0.9, image.naturalWidth, image.naturalHeight * 0.1, 0, 0, canvas.width, canvas.height
      )
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      const colors = []
      for (let segment = 0; segment < 5; segment++) {
        let red = 0
        let green = 0
        let blue = 0
        let count = 0

        for (let y = 0; y < canvas.height; y++) {
          for (let x = segment * 10; x < (segment + 1) * 10; x++) {
            const index = (y * canvas.width + x) * 4
            if (pixels[index + 3] < 180) continue
            red += pixels[index]
            green += pixels[index + 1]
            blue += pixels[index + 2]
            count++
          }
        }

        if (!count) return
        colors.push(`rgb(${Math.round(red / count)} ${Math.round(green / count)} ${Math.round(blue / count)})`)
      }

      const gradientStops = colors.map((color, index) => `${color} ${index * 25}%`).join(', ')
      const gradient = `linear-gradient(90deg, ${gradientStops}, ${colors[ 4 ]} 100%)`
      this.featuredGradients.update(gradients => ({ ...gradients, [uuid]: gradient }))
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
      likes: '最多点赞',
      coins: '最多投币',
      favorites: '最多收藏'
    }[this.sort()]
  }

  categoryTitle () {
    return this.categories.find(item => item.id === this.category())?.title || '游戏'
  }

  private startCarousel () {
    this.carouselTimer = setInterval(() => this.nextCarousel(), 6000)
  }

  private onVisibilityChange = () => {
    if (this.carouselTimer) clearInterval(this.carouselTimer)
    if (!document.hidden) this.startCarousel()
  }
}
