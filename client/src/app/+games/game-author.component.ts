import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core'
import { AuthService } from '@app/core/auth/auth.service'
import { LoginModalService } from '@app/+login/login-modal.service'
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
  private readonly loginModalService = inject(LoginModalService)
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
  /** 排序切换时的网格局部刷新状态（不触发整页骨架屏） */
  readonly gridLoading = signal(false)
  readonly gridError = signal('')
  private worksGeneration = 0

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
      // 同一作者内仅排序变化时局部刷新作品网格，横幅/统计保持不动，避免整页骨架屏闪烁
      const isSameAuthor = this.currentAccountId === accountId && this.author() !== null
      this.currentAccountId = accountId
      if (isSameAuthor) this.refreshWorks(accountId)
      else this.loadAuthor(accountId)
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
      this.loginModalService.open({ returnUrl: this.router.url, inPlace: true })
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
    this.worksGeneration += 1
    this.gridLoading.set(false)
    this.gridError.set('')
    this.authorState.load(this.gamesService.author(accountId, this.sort()))
  }

  /** 排序切换：仅回写作品列表，页面主体与旧网格保持挂载 */
  private refreshWorks (accountId: string) {
    const generation = ++this.worksGeneration
    this.gridLoading.set(true)
    this.gridError.set('')
    this.gamesService.author(accountId, this.sort()).subscribe({
      next: result => {
        if (generation !== this.worksGeneration || this.currentAccountId !== accountId) return
        this.authorState.data.update(value => value ? { ...value, data: result.data } : result)
        this.gridLoading.set(false)
      },
      error: err => {
        if (generation !== this.worksGeneration || this.currentAccountId !== accountId) return
        this.gridError.set(getGameActionErrorMessage(err))
        this.gridLoading.set(false)
      }
    })
  }
}
