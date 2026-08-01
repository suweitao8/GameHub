import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output, signal, WritableSignal } from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { AuthService } from '@app/core/auth/auth.service'
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
  styles: [ `
    /* On the game-play page the panel is transparent & full-width. */
    .game-community-panel { background: transparent;
      border: 0;
      border-radius: 0;
      padding: 0;
      width: 100%; }

    .feedback { color: var(--game-success);
      margin: 0.7rem 0 0; }
    .action-feedback { animation: game-action-pop 180ms ease-out; }

    .interaction-row { align-items: center;
      border-bottom: 1px solid var(--game-border);
      gap: 1.5rem;
      padding: 0.7rem 0 0.85rem; }
    .interaction-row button { align-items: center;
      background: transparent;
      border: 0;
      border-radius: 0;
      color: var(--game-muted);
      display: inline-flex;
      font-weight: 600;
      gap: 0.35rem;
      padding: 0.35rem 0.15rem;
      transition: color 160ms ease; }
    .interaction-row button:hover,
    .interaction-row button:focus-visible,
    .interaction-row button.active { background: transparent;
      color: var(--game-brand); }
    .interaction-row button:first-child { font-size: 1rem; }
    .game-action-button { flex-direction: row;
      gap: 0.4rem !important;
      min-height: 2rem;
      min-width: 3rem;
      padding: 0.1rem 0 !important; }
    .game-action-button > my-global-icon { color: inherit;
      height: 1.45rem;
      width: 1.45rem; }
    .game-action-button > my-global-icon ::ng-deep svg { stroke-width: 2.1; }
    .game-action-button strong {
      color: inherit;
      font-size: 0.82rem;
      font-weight: 600;
      line-height: 1.2;
      min-height: 0.8rem;
    }
    .game-action-button small {
      color: var(--game-muted);
      display: none;
      font-size: 0.72rem;
      line-height: 1;
    }
    .game-action-button.active > span,
    .game-action-button.active > my-global-icon,
    .game-action-button.active strong,
    .game-action-button.active small { color: var(--game-brand); }
    @keyframes game-action-pop { from { opacity: 0;
        transform: translateY(-3px); } to { opacity: 1;
        transform: translateY(0); } }

    .game-description-panel {
      border-top: 1px solid var(--game-border);
      margin-top: 1rem;
      padding-top: 0.95rem;
    }
    .game-description-fallback {
      background: #fff;
      border-bottom: 1px solid var(--game-border);
      border-top: 1px solid var(--game-border);
      padding: 0.85rem 0;
      width: 100%;
    }
    .description-heading {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem 1rem;
      justify-content: space-between;
      margin-bottom: 0.45rem;
    }
    .game-description-panel h2 { font-size: 1rem;
      margin: 0; }
    .game-description-panel p { color: var(--game-muted);
      font-size: 0.82rem;
      line-height: 1.7;
      margin: 0;
      white-space: pre-wrap; }
    .description-tags {
      margin-top: 0.75rem;
    }

    /* Game tags */
    .game-tags { display: flex;
      flex-wrap: wrap;
      gap: 0.5rem; }
    .game-tag { background: rgb(0 174 236 / 8%);
      border: 1px solid rgb(0 174 236 / 18%);
      border-radius: 999px;
      color: var(--game-brand);
      display: inline-block;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.25rem 0.7rem;
      text-decoration: none;
      transition: all 160ms ease;
      white-space: nowrap; }
    .game-tag:hover { background: var(--game-brand);
      border-color: var(--game-brand);
      color: #fff; }

    @media (max-width: 600px) {
      .game-action-button { min-width: 2.8rem; padding: 0.05rem 0.2rem !important; }
      .game-action-button > my-global-icon { height: 1.1rem; width: 1.1rem; }
      .game-action-button strong { font-size: 0.7rem; }
      .game-action-button small { font-size: 0.65rem; }
    }
  ` ],
  template: `
    @if (community(); as state) {
      <section class="game-community-panel" aria-label="游戏互动操作">
        <div class="interaction-row">
          <button class="game-action-button" type="button"
            [attr.aria-label]="'点赞 ' + state.likes" [class.active]="state.rating === 'like'" (click)="toggleRate()">
            <my-global-icon iconName="like" /><strong>{{ state.likes }}</strong>
          </button>
          <button class="game-action-button" type="button"
            [attr.aria-label]="'投币 ' + state.coins" [disabled]="coinLoading()" (click)="giveCoin()">
            <my-global-icon iconName="coin" /><strong>{{ state.coins }}</strong>
          </button>
          <button class="game-action-button" type="button" aria-label="收藏" [class.active]="state.favorite" (click)="toggleFavorite()">
            <my-global-icon iconName="star" /><strong>{{ state.favorite ? '已收藏' : '收藏' }}</strong>
          </button>
          <button class="game-action-button" type="button" aria-label="分享" (click)="share.emit()">
            <my-global-icon iconName="share" /><strong>分享</strong>
          </button>
        </div>
        @if (actionFeedback()) { <p class="feedback action-feedback" role="status">{{ actionFeedback() }}</p> }

        <section class="game-description-panel" aria-labelledby="game-description-title">
          <div class="description-heading">
            <h2 id="game-description-title">简介</h2>
          </div>
          <p>{{ game?.description || '作者还没有填写简介。' }}</p>
          @if (game?.tags?.length) {
            <div class="game-tags description-tags">
              @for (tag of game!.tags!; track tag) {
                <a class="game-tag" [routerLink]="['/games']" [queryParams]="{ search: tag }">{{ tag }}</a>
              }
            </div>
          }
        </section>
      </section>
    } @else if (communityError) {
      <p class="feedback" role="alert">{{ communityError }}</p>
      <section class="game-description-panel game-description-fallback" aria-labelledby="game-description-title">
        <h2 id="game-description-title">简介</h2>
        <p>{{ game?.description || '作者还没有填写简介。' }}</p>
      </section>
    } @else {
      <section class="game-description-panel game-description-fallback" aria-labelledby="game-description-title">
        <h2 id="game-description-title">简介</h2>
        <p>{{ game?.description || '作者还没有填写简介。' }}</p>
      </section>
    }
  `
})
export class GameCommunityPanelComponent {
  private readonly gamesService = inject(GamesService)
  private readonly authService = inject(AuthService)
  private readonly router = inject(Router)

  /** Shared community signal, owned by the host. Read/written in place. */
  @Input({ required: true }) community!: WritableSignal<GameCommunity | null>
  @Input({ required: true }) uuid = ''
  @Input() game: Game | null = null
  @Input() communityError = ''

  @Output() share = new EventEmitter<void>()

  readonly coinLoading = signal(false)
  readonly actionFeedback = signal('')

  toggleRate () {
    if (!this.requireLogin()) return
    const current = this.community()
    if (!current) return
    const next = current.rating === 'like' ? 'none' : 'like'
    this.gamesService.rate(this.uuid, next).subscribe({
      next: () => this.gamesService.community(this.uuid).subscribe({
        next: value => {
          this.community.set(value)
          this.actionFeedback.set(next === 'like' ? '点赞成功' : next === 'none' ? '已取消点赞' : '已记录你的反馈')
        }
      }),
      error: error => this.actionFeedback.set(getGameActionErrorMessage(error))
    })
  }

  toggleFavorite () {
    if (!this.requireLogin()) return
    const current = this.community()
    if (!current) return
    this.gamesService.favorite(this.uuid, !current.favorite).subscribe({
      next: value => {
        this.community.update(state => state ? { ...state, favorite: value.favorite } : state)
        this.actionFeedback.set(value.favorite ? '已加入收藏' : '已取消收藏')
      },
      error: error => this.actionFeedback.set(getGameActionErrorMessage(error))
    })
  }

  giveCoin () {
    if (!this.requireLogin()) return
    const state = this.community()
    if (!state || this.coinLoading()) return
    this.coinLoading.set(true)
    this.gamesService.coin(this.uuid, 1).subscribe({
      next: value => {
        this.coinLoading.set(false)
        this.actionFeedback.set('投币成功')
        this.community.update(current => current
          ? { ...current, coins: current.coins + 1, coinBalance: value.coinBalance, coinsGiven: value.coinsGiven }
          : current)
      },
      error: error => {
        this.coinLoading.set(false)
        this.actionFeedback.set(getGameActionErrorMessage(error))
      }
    })
  }

  private requireLogin () {
    if (this.authService.isLoggedIn()) return true
    void this.router.navigate([ '/login' ], { queryParams: { returnUrl: this.router.url } })
    return false
  }
}
