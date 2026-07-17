import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { GamesService, Game } from './games.service'

@Component({
  templateUrl: './games-home.component.html',
  styleUrl: './games-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink ]
})
export class GamesHomeComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  private readonly route = inject(ActivatedRoute)

  readonly games = signal<Game[]>([])
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

    this.gamesService.list({ search: this.search() || undefined, category: this.category() || undefined, count: 24 }).subscribe({
      next: result => {
        this.games.set(result.data)
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
