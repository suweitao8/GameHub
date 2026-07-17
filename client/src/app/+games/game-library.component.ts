import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { GamesService, Game } from './games.service'

@Component({
  templateUrl: './game-library.component.html',
  styleUrl: './game-library.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink ]
})
export class GameLibraryComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  readonly tab = signal<'recent' | 'favorites' | 'owned'>('recent')
  readonly games = signal<Game[]>([])
  readonly error = signal('')

  ngOnInit () { this.load() }

  selectTab (tab: 'recent' | 'favorites' | 'owned') {
    this.tab.set(tab)
    this.load()
  }

  private load () {
    const request = this.tab() === 'favorites'
      ? this.gamesService.listFavorites()
      : this.tab() === 'owned' ? this.gamesService.listOwned() : this.gamesService.listRecent()
    request.subscribe({
      next: result => { this.games.set(result.data); this.error.set('') },
      error: () => this.error.set('请先登录后查看你的游戏收藏、最近游玩和创作内容。')
    })
  }
}
