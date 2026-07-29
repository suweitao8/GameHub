import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { Subscription } from 'rxjs'
import { GameCardComponent } from './game-card.component'
import { GameSkeletonComponent } from './game-skeleton.component'
import { createAsyncState } from './shared'
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
  readonly libraryState = createAsyncState<Game[]>([])
  /** 模板兼容 */
  readonly games = computed(() => this.libraryState.data() ?? [])
  readonly loading = this.libraryState.loading
  readonly error = this.libraryState.error
  readonly hasError = this.libraryState.hasError

  constructor () {
    // 对齐原 signal(true)
    this.libraryState.loading.set(true)
  }

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
    const request = this.tab() === 'favorites'
      ? this.gamesService.listFavorites()
      : this.tab() === 'owned' ? this.gamesService.listOwned() : this.gamesService.listRecent()
    // 使用 libraryState 管理三态；登录失败给出更友好的自定义消息
    this.libraryState.loading.set(true)
    this.libraryState.error.set('')
    request.subscribe({
      next: result => { this.libraryState.data.set(result.data); this.libraryState.loading.set(false) },
      error: () => { this.libraryState.error.set('请先登录后查看你的游戏收藏、最近游玩和创作内容。'); this.libraryState.loading.set(false) }
    })
  }
}
