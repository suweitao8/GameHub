import { ChangeDetectionStrategy, Component, inject, input, output, signal, WritableSignal, Input } from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { AuthService } from '@app/core/auth/auth.service'
import { LoginModalService } from '@app/+login/login-modal.service'
import { Game, GameCommunity, GamesService } from './games.service'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { getGameActionErrorMessage } from './game-action-feedback'

/**
 * Game interaction panel: like / coin / favorite / share row and the
 * description block. Reviews are text-only and do not contain star scoring.
 *
 * Owns the interaction state (action feedback and coin request)
 * but reads/writes the shared `community` signal owned by the host so the
 * developer sidebar stays in sync. Watch-later and share/report are surfaced
 * as outputs because they cross into host-owned concerns.
 */
@Component({
  selector: 'my-game-community-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink, GlobalIconComponent ],
  styleUrl: './game-community-panel.component.scss',
  template: `
    @if (community(); as state) {
      <section class="game-community-panel" aria-label="游戏互动操作">
        <div class="interaction-row">
          <button class="game-action-button" type="button"
            [attr.aria-label]="'点赞 ' + state.likes" [class.active]="state.rating === 'like'"
            [disabled]="actionLoading() !== null" (click)="toggleRate()">
            <my-global-icon iconName="like" /><strong>{{ state.likes }}</strong>
          </button>
          <button class="game-action-button" type="button"
            [attr.aria-label]="'投币 ' + state.coins" [disabled]="actionLoading() !== null" (click)="giveCoin()">
            <my-global-icon iconName="coin" /><strong>{{ state.coins }}</strong>
          </button>
          <button class="game-action-button" type="button"
            [attr.aria-label]="'收藏 ' + state.favorites" [class.active]="state.favorite"
            [disabled]="actionLoading() !== null" (click)="toggleFavorite()">
            <my-global-icon iconName="star" /><strong>{{ state.favorites }}</strong>
          </button>
          <button class="game-action-button" type="button" [attr.aria-label]="'分享 ' + state.shares" (click)="share.emit()">
            <my-global-icon iconName="share" /><strong>{{ state.shares }}</strong>
          </button>
        </div>
        @if (actionFeedback()) { <p class="feedback action-feedback" role="status">{{ actionFeedback() }}</p> }

        <section class="game-description-panel" aria-labelledby="game-description-title">
          <h2 id="game-description-title" class="visually-hidden">游戏信息</h2>
          <div class="game-description-tabs" role="tablist" aria-label="游戏信息分类">
            <button type="button" class="game-description-tab" role="tab"
              id="game-description-overview-tab" aria-controls="game-description-panel"
              [class.active]="descriptionTab() === 'overview'"
              [attr.aria-selected]="descriptionTab() === 'overview'"
              [attr.tabindex]="descriptionTab() === 'overview' ? 0 : -1"
              (keydown)="onDescriptionTabKeydown($event, 'overview')"
              (click)="descriptionTab.set('overview')">简介</button>
            <button type="button" class="game-description-tab" role="tab"
              id="game-description-controls-tab" aria-controls="game-description-panel"
              [class.active]="descriptionTab() === 'controls'"
              [attr.aria-selected]="descriptionTab() === 'controls'"
              [attr.tabindex]="descriptionTab() === 'controls' ? 0 : -1"
              (keydown)="onDescriptionTabKeydown($event, 'controls')"
              (click)="descriptionTab.set('controls')">操作</button>
          </div>
          <div
            id="game-description-panel"
            class="game-description-content"
            role="tabpanel"
            [attr.aria-labelledby]="descriptionTab() === 'overview' ? 'game-description-overview-tab' : 'game-description-controls-tab'"
          >
            @if (descriptionTab() === 'overview') {
              <p>{{ game()?.description || '作者还没有填写简介。' }}</p>
              @if (game()?.tags?.length) {
                <div class="game-tags description-tags">
                  @for (tag of game()!.tags!; track tag) {
                    <a class="game-tag" [routerLink]="['/games']" [queryParams]="{ search: tag }">{{ tag }}</a>
                  }
                </div>
              }
            } @else {
              <dl class="game-description-table">
                <div><dt>操作说明</dt><dd>{{ game()?.instructions || '作者还没有填写操作说明。' }}</dd></div>
              </dl>
            }
          </div>
        </section>
      </section>
    } @else if (communityError()) {
      <p class="feedback" role="alert">{{ communityError() }}</p>
      <section class="game-description-panel game-description-fallback" aria-labelledby="game-description-title">
        <h2 id="game-description-title">简介</h2>
        <p>{{ game()?.description || '作者还没有填写简介。' }}</p>
      </section>
    } @else {
      <section class="game-description-panel game-description-fallback" aria-labelledby="game-description-title">
        <h2 id="game-description-title">简介</h2>
        <p>{{ game()?.description || '作者还没有填写简介。' }}</p>
      </section>
    }
  `
})
export class GameCommunityPanelComponent {
  private readonly gamesService = inject(GamesService)
  private readonly authService = inject(AuthService)
  private readonly loginModalService = inject(LoginModalService)
  private readonly router = inject(Router)

  /** Shared community signal, owned by the host. Read/written in place. */
  @Input({ required: true }) community!: WritableSignal<GameCommunity | null>
  readonly uuid = input.required<string>()
  readonly game = input<Game | null>(null)
  readonly communityError = input('')

  readonly share = output()

  readonly coinLoading = signal(false)
  readonly actionLoading = signal<'rate' | 'favorite' | 'coin' | null>(null)
  readonly actionFeedback = signal('')
  readonly descriptionTab = signal<'overview' | 'controls'>('overview')

  onDescriptionTabKeydown (event: KeyboardEvent, current: 'overview' | 'controls') {
    const tabs = [ 'overview', 'controls' ] as const
    const currentIndex = tabs.indexOf(current)
    const nextIndex = event.key === 'ArrowRight'
      ? (currentIndex + 1) % tabs.length
      : event.key === 'ArrowLeft'
        ? (currentIndex + tabs.length - 1) % tabs.length
        : -1
    if (nextIndex < 0) return

    event.preventDefault()
    const next = tabs[nextIndex]
    this.descriptionTab.set(next)
    document.getElementById(`game-description-${next}-tab`)?.focus()
  }

  toggleRate () {
    if (!this.requireLogin()) return
    if (this.actionLoading() !== null) return
    const current = this.community()
    if (!current) return
    const next = current.rating === 'like' ? 'none' : 'like'
    this.actionLoading.set('rate')
    this.gamesService.rate(this.uuid(), next).subscribe({
      next: () => this.gamesService.community(this.uuid()).subscribe({
        next: value => {
          this.community.set(value)
          this.actionFeedback.set(next === 'like' ? '点赞成功' : next === 'none' ? '已取消点赞' : '已记录你的反馈')
          this.actionLoading.set(null)
        },
        error: error => {
          this.actionLoading.set(null)
          this.actionFeedback.set(getGameActionErrorMessage(error))
        }
      }),
      error: error => {
        this.actionLoading.set(null)
        this.actionFeedback.set(getGameActionErrorMessage(error))
      }
    })
  }

  toggleFavorite () {
    if (!this.requireLogin()) return
    if (this.actionLoading() !== null) return
    const current = this.community()
    if (!current) return
    this.actionLoading.set('favorite')
    this.gamesService.favorite(this.uuid(), !current.favorite).subscribe({
      next: value => {
        this.community.update(state => state
          ? {
              ...state,
              favorite: value.favorite,
              favorites: Math.max(0, state.favorites + (value.favorite ? 1 : -1))
            }
          : state)
        this.actionFeedback.set(value.favorite ? '已加入收藏' : '已取消收藏')
        this.actionLoading.set(null)
      },
      error: error => {
        this.actionLoading.set(null)
        this.actionFeedback.set(getGameActionErrorMessage(error))
      }
    })
  }

  giveCoin () {
    if (!this.requireLogin()) return
    const state = this.community()
    if (!state || this.actionLoading() !== null) return
    this.actionLoading.set('coin')
    this.coinLoading.set(true)
    this.gamesService.coin(this.uuid(), 1).subscribe({
      next: value => {
        this.actionLoading.set(null)
        this.coinLoading.set(false)
        this.actionFeedback.set('投币成功')
        this.community.update(current => current
          ? { ...current, coins: current.coins + 1, coinBalance: value.coinBalance, coinsGiven: value.coinsGiven }
          : current)
      },
      error: error => {
        this.actionLoading.set(null)
        this.coinLoading.set(false)
        this.actionFeedback.set(getGameActionErrorMessage(error))
      }
    })
  }

  private requireLogin () {
    if (this.authService.isLoggedIn()) return true
    this.loginModalService.open({ returnUrl: this.router.url, inPlace: true })
    return false
  }
}
