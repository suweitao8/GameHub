import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core'
import { AuthService } from '@app/core/auth/auth.service'
import { ActivatedRoute, Router } from '@angular/router'
import { buildGameAvatarDataUrl } from '../shared/game-avatar'
import { GameCardComponent } from './game-card.component'
import { GameSkeletonComponent } from './game-skeleton.component'
import { createAsyncState } from './shared'
import { getGameActionErrorMessage } from './game-action-feedback'
import { GameAuthor, GamesService } from './games.service'
import { combineLatest, Subscription } from 'rxjs'

@Component({
  templateUrl: './game-author.component.html',
  styleUrl: './game-author.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GameCardComponent, GameSkeletonComponent ]
})
export class GameAuthorComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute)
  private readonly gamesService = inject(GamesService)
  private readonly authService = inject(AuthService)
  private readonly router = inject(Router)
  private routeSubscription: Subscription | undefined
  private currentAccountId = ''
  readonly authorState = createAsyncState<GameAuthor>()
  /** 模板兼容：直接返回 data，避免大量 author() 引用改写 */
  readonly author = computed(() => this.authorState.data())
  readonly loading = this.authorState.loading
  readonly hasError = this.authorState.hasError
  readonly followLoading = signal(false)
  readonly actionFeedback = signal('')
  readonly sort = signal<'latest' | 'plays' | 'favorites'>('latest')

  constructor () {
    // 初始即处于加载态（对齐原 signal(true)），避免首帧渲染错误占位
    this.authorState.loading.set(true)
  }

  ngOnInit () {
    this.routeSubscription = combineLatest([ this.route.paramMap, this.route.queryParamMap ]).subscribe(([ params, query ]) => {
      const accountId = params.get('accountId')
      if (!accountId) return
      const sort = query.get('sort')
      this.sort.set(sort === 'plays' || sort === 'favorites' ? sort : 'latest')
      this.currentAccountId = accountId
      this.loadAuthor(accountId)
    })
  }

  ngOnDestroy () {
    this.routeSubscription?.unsubscribe()
  }

  selectSort (sort: 'latest' | 'plays' | 'favorites') {
    if (this.sort() === sort) return

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sort: sort === 'latest' ? null : sort },
      queryParamsHandling: 'merge'
    })
  }

  toggleFollow () {
    const current = this.author()
    if (!current || this.followLoading()) return
    if (!this.authService.isLoggedIn()) {
      void this.router.navigate([ '/login' ], { queryParams: { returnUrl: this.router.url } })
      return
    }
    this.actionFeedback.set('')
    this.followLoading.set(true)
    this.gamesService.followAuthor(current.account.id, !current.following).subscribe({
      next: result => {
        this.authorState.data.update(value => value ? { ...value, following: result.following } : value)
        this.followLoading.set(false)
      },
      error: error => {
        this.actionFeedback.set(getGameActionErrorMessage(error))
        this.followLoading.set(false)
      }
    })
  }

  isOwnAuthor () {
    return this.authService.getUser()?.account?.id === this.author()?.account.id
  }

  formatNumber (num: number): string {
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return String(num)
  }

  getAvatarUrl () {
    const account = this.author()?.account
    return buildGameAvatarDataUrl(account?.displayName || account?.name || '创')
  }

  retryLoad () {
    if (!this.currentAccountId) return
    this.loadAuthor(this.currentAccountId)
  }

  private loadAuthor (accountId: string) {
    this.authorState.load(this.gamesService.author(accountId, this.sort()))
  }
}
