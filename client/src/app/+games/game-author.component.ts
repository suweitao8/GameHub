import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { GameCardComponent } from './game-card.component'
import { GameAuthor, GamesService } from './games.service'

@Component({
  templateUrl: './game-author.component.html',
  styleUrl: './game-author.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GameCardComponent, RouterLink ]
})
export class GameAuthorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute)
  private readonly gamesService = inject(GamesService)
  readonly author = signal<GameAuthor | null>(null)
  readonly loading = signal(true)
  readonly error = signal(false)

  ngOnInit () {
    this.route.paramMap.subscribe(params => {
      const accountId = params.get('accountId')
      if (!accountId) return
      this.gamesService.author(accountId).subscribe({
        next: value => { this.author.set(value); this.loading.set(false) },
        error: () => { this.error.set(true); this.loading.set(false) }
      })
    })
  }
}
