import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { GameCardComponent } from './game-card.component'
import { GameCreatorOverview, GamesService } from './games.service'

@Component({
  templateUrl: './game-creator.component.html',
  styleUrl: './game-creator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GameCardComponent, RouterLink ]
})
export class GameCreatorComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  readonly overview = signal<GameCreatorOverview | null>(null)
  readonly error = signal('')

  ngOnInit () {
    this.gamesService.creatorOverview().subscribe({ next: value => this.overview.set(value), error: () => this.error.set('请先登录后进入创作中心。') })
  }

  formatBytes (bytes: number) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
}
