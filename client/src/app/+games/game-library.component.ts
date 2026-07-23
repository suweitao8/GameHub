import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { Subscription } from 'rxjs'
import { GameCardComponent } from './game-card.component'
import { GameSkeletonComponent } from './game-skeleton.component'
import { GamesService, Game } from './games.service'

@Component({
  templateUrl: './game-library.component.html',
  styleUrl: './game-library.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GameCardComponent, GameSkeletonComponent, RouterLink ]
})
export class GameLibraryComponent implements OnInit, OnDestroy {
  private readonly gamesService = inject(GamesService)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private routeSubscription: Subscription | undefined
  readonly tab = signal<'recent' | 'favorites' | 'owned'>('recent')
  readonly games = signal<Game[]>([])
  readonly loading = signal(true)
  readonly error = signal('')

  ngOnInit () {
    this.routeSubscription = this.route.queryParamMap.subscribe(query => {
      const tab = query.get('tab')
      const nextTab = tab === 'favorites' || tab === 'owned' || tab === 'recent' ? tab : 'recent'
      if (this.tab() !== nextTab) this.tab.set(nextTab)
      this.load()
    })
  }

  ngOnDestroy () {
    this.routeSubscription?.unsubscribe()
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

  load () {
    this.loading.set(true)
    const request = this.tab() === 'favorites'
      ? this.gamesService.listFavorites()
      : this.tab() === 'owned' ? this.gamesService.listOwned() : this.gamesService.listRecent()
    request.subscribe({
      next: result => { this.games.set(result.data); this.error.set(''); this.loading.set(false) },
      error: () => { this.error.set('请先登录后查看你的游戏收藏、最近游玩和创作内容。'); this.loading.set(false) }
    })
  }
}
