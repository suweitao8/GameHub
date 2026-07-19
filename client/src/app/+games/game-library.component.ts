import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { GameCardComponent } from './game-card.component'
import { GamesService, Game } from './games.service'

@Component({
  templateUrl: './game-library.component.html',
  styleUrl: './game-library.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GameCardComponent, RouterLink ]
})
export class GameLibraryComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  readonly tab = signal<'recent' | 'favorites' | 'owned'>('recent')
  readonly games = signal<Game[]>([])
  readonly loading = signal(true)
  readonly error = signal('')

  ngOnInit () {
    this.route.queryParamMap.subscribe(query => {
      const tab = query.get('tab')
      const nextTab = tab === 'favorites' || tab === 'owned' || tab === 'recent' ? tab : 'recent'
      if (this.tab() !== nextTab) this.tab.set(nextTab)
      this.load()
    })
  }

  selectTab (tab: 'recent' | 'favorites' | 'owned') {
    if (this.tab() === tab) return

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    })
  }

  getDownloadUrl (uuid: string) {
    return this.gamesService.buildDownloadUrl(uuid)
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
