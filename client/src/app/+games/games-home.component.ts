import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { forkJoin } from 'rxjs'
import { GameCardComponent } from './game-card.component'
import { GamesService, Game } from './games.service'
import { GamesListParams } from './games-api'

@Component({
  templateUrl: './games-home.component.html',
  styleUrl: './games-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GameCardComponent, RouterLink ]
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
  readonly category = signal('')
  readonly device = signal<GamesListParams['device']>(undefined)
  readonly publishedAfter = signal('')
  readonly sort = signal<GamesListParams['sort']>('recommended')

  ngOnInit () {
    this.route.queryParamMap.subscribe(params => {
      this.category.set(params.get('category') || '')
      this.search.set(params.get('search') || '')
      this.device.set(params.get('device') as GamesListParams['device'] || undefined)
      this.publishedAfter.set(params.get('publishedAfter') || '')
      const requestedSort = params.get('sort') as GamesListParams['sort']
      const validSorts = [ 'recommended', 'latest', 'popular', 'likes', 'coins', 'favorites' ]
      this.sort.set(validSorts.includes(requestedSort || '') ? requestedSort : 'recommended')
      this.loadGames()
    })
  }

  loadGames () {
    this.loading.set(true)
    this.error.set(false)
    const common = {
      search: this.search() || undefined,
      category: this.category() || undefined,
      publishedAfter: this.publishedAfter() || undefined,
      device: this.device(),
      count: 8
    }

    if (this.sort() !== 'recommended') {
      this.gamesService.list({ ...common, sort: this.sort() }).subscribe({
        next: result => {
          this.recommended.set(result.data)
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
      recommended: this.gamesService.list({ ...common, sort: 'recommended' })
    }).subscribe({
      next: result => {
        this.latest.set(result.latest.data)
        this.popular.set(result.popular.data)
        this.recommended.set(result.recommended.data)
        this.loading.set(false)
      },
      error: () => {
        this.error.set(true)
        this.loading.set(false)
      }
    })
  }

  onSearch (event: Event) {
    event.preventDefault()
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
