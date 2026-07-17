import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { forkJoin } from 'rxjs'
import { GameCardComponent } from './game-card.component'
import { GamesService, Game } from './games.service'

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

  ngOnInit () {
    this.route.queryParamMap.subscribe(params => {
      this.category.set(params.get('category') || '')
      this.search.set(params.get('search') || '')
      this.loadGames()
    })
  }

  loadGames () {
    this.loading.set(true)
    this.error.set(false)
    const common = { search: this.search() || undefined, category: this.category() || undefined, count: 8 }

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
}
