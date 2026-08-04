import { DatePipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core'
import { AuthService } from '@app/core/auth/auth.service'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { buildGameAvatarDataUrl } from '../shared/game-avatar'
import { GameCardComponent } from './game-card.component'
import { GameSkeletonComponent } from './game-skeleton.component'
import { createAsyncState } from './shared'
import { getGameActionErrorMessage } from './game-action-feedback'
import { Game, GameAuthor, GamesService } from './games.service'
import { combineLatest, Subscription } from 'rxjs'

type AuthorTab = 'home' | 'activity' | 'games' | 'collections'

@Component({
  templateUrl: './game-author.component.html',
  styleUrl: './game-author.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GameCardComponent, GameSkeletonComponent, RouterLink, DatePipe ]
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
  readonly tab = signal<AuthorTab>('home')
  readonly collections = computed(() => {
    const groups = new Map<string, Game[]>()
    for (const game of this.author()?.data || []) {
      const category = game.category || 'other'
      groups.set(category, [ ...(groups.get(category) || []), game ])
    }

    return [ ...groups.entries() ].map(([ category, games ]) => ({ category, games }))
  })

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
      const tab = query.get('tab')
      this.tab.set(tab === 'activity' || tab === 'games' || tab === 'collections' ? tab : 'home')
      this.currentAccountId = accountId
      this.loadAuthor(accountId)
    })
  }

  ngOnDestroy () {
    this.routeSubscription?.unsubscribe()
  }

  selectTab (tab: AuthorTab) {
    if (this.tab() === tab) return

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'home' ? null : tab },
      queryParamsHandling: 'merge'
    })
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

  categoryLabel (category: string) {
    return {
      arcade: '动作',
      adventure: '冒险',
      shooter: '射击',
      puzzle: '解谜',
      casual: '休闲',
      rpg: '角色扮演',
      strategy: '策略',
      simulation: '模拟',
      sandbox: '沙盒',
      racing: '竞速',
      sports: '体育',
      card: '卡牌',
      music: '音乐',
      horror: '恐怖',
      board: '桌游',
      other: '其他'
    }[category] || '其他'
  }

  retryLoad () {
    if (!this.currentAccountId) return
    this.loadAuthor(this.currentAccountId)
  }

  private loadAuthor (accountId: string) {
    this.authorState.load(this.gamesService.author(accountId, this.sort()))
  }
}
