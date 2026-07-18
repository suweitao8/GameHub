import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { forkJoin } from 'rxjs'
import { GameCardComponent } from './game-card.component'
import { GamesService, Game } from './games.service'
import { GamesListParams } from './games-api'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

@Component({
  templateUrl: './games-home.component.html',
  styleUrl: './games-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GameCardComponent, GlobalIconComponent, RouterLink ]
})
export class GamesHomeComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  private readonly route = inject(ActivatedRoute)

  readonly latest = signal<Game[]>([])
  readonly popular = signal<Game[]>([])
  readonly recommended = signal<Game[]>([])
  readonly loading = signal(true)
  readonly error = signal(false)
  readonly search = signal('')
  readonly view = signal('')
  readonly searchMode = signal(false)
  readonly category = signal('')
  readonly device = signal<GamesListParams['device']>(undefined)
  readonly publishedAfter = signal('')
  readonly sort = signal<GamesListParams['sort']>('recommended')
  readonly recommendedOffset = signal(0)
  readonly recommendedTotal = signal(0)
  readonly categories = [
    { id: 'arcade', title: '动作', description: '快速反应，马上开始一局。' },
    { id: 'puzzle', title: '解谜', description: '动动脑筋，找出下一步。' },
    { id: 'casual', title: '休闲', description: '轻松打开，随时玩一会儿。' },
    { id: 'strategy', title: '策略', description: '规划资源，赢下更大的局。' },
    { id: 'horror', title: '恐怖', description: '戴上耳机，探索未知角落。' },
    { id: 'mobile', title: '手机可玩', description: '触屏友好，移动设备也能玩。' }
  ]

  ngOnInit () {
    this.searchMode.set(this.route.snapshot.routeConfig?.path === 'search')
    this.route.queryParamMap.subscribe(params => {
      this.view.set(params.get('view') || '')
      this.category.set(params.get('category') || '')
      this.search.set(params.get('search') || '')
      this.device.set(params.get('device') as GamesListParams['device'] || undefined)
      this.publishedAfter.set(params.get('publishedAfter') || '')
      const requestedSort = params.get('sort') as GamesListParams['sort']
      const validSorts = [ 'recommended', 'latest', 'popular', 'likes', 'coins', 'favorites' ]
      this.sort.set(validSorts.includes(requestedSort || '') ? requestedSort : 'recommended')
      this.recommendedOffset.set(0)
      this.loadGames()
    })
  }

  loadGames () {
    if (this.view() === 'categories') {
      this.latest.set([])
      this.popular.set([])
      this.recommended.set([])
      this.loading.set(false)
      return
    }

    this.loading.set(true)
    this.error.set(false)
    const common: GamesListParams = {
      search: this.search() || undefined,
      category: this.category() || undefined,
      publishedAfter: this.publishedAfter() || undefined,
      device: this.device(),
      view: this.view() === 'following' ? 'following' : undefined,
      count: 8
    }

    if (this.view() === 'following') {
      this.gamesService.list({ ...common, sort: 'latest' }).subscribe({
        next: result => {
          this.recommended.set(result.data)
          this.recommendedTotal.set(result.total)
          this.popular.set([])
          this.latest.set([])
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
          this.recommendedTotal.set(result.total)
          this.popular.set([])
          this.latest.set([])
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
          this.recommendedTotal.set(result.total)
          this.popular.set([])
          this.latest.set([])
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
      latest: this.gamesService.list({ ...common, sort: 'latest' }),
      popular: this.gamesService.list({ ...common, sort: 'popular' }),
      recommended: this.gamesService.list({ ...common, sort: 'recommended', start: this.recommendedOffset() })
    }).subscribe({
      next: result => {
        this.latest.set(result.latest.data)
        this.popular.set(result.popular.data)
        this.recommended.set(result.recommended.data)
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

  onSortChange (event: Event) {
    const sort = (event.target as HTMLSelectElement).value as GamesListParams['sort']
    this.sort.set(sort || 'recommended')
    this.loadGames()
  }

  onDeviceChange (event: Event) {
    this.device.set((event.target as HTMLSelectElement).value as GamesListParams['device'] || undefined)
    this.loadGames()
  }

  onPublishedAfterChange (event: Event) {
    this.publishedAfter.set((event.target as HTMLInputElement).value)
    this.loadGames()
  }
}
