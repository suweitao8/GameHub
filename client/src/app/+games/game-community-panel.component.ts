import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output, signal, WritableSignal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { AuthService } from '@app/core/auth/auth.service'
import { Router } from '@angular/router'
import { Game, GameCommunity, GamesService } from './games.service'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { getGameActionErrorMessage } from './game-action-feedback'

/**
 * Game interaction panel: like / coin / favorite / triple / share row, the
 * coin composer, and the description block with rating stars and tags.
 *
 * Owns the interaction state (action feedback, triple animation, coin form)
 * but reads/writes the shared `community` signal owned by the host so the
 * developer sidebar stays in sync. Watch-later and share/report are surfaced
 * as outputs because they cross into host-owned concerns.
 */
@Component({
  selector: 'my-game-community-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink, GlobalIconComponent ],
  styles: [`
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
      gap: 1.7rem;
      padding: 0.45rem 0 0.8rem; }
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
    .game-action-button { flex-direction: column;
      gap: 0.12rem !important;
      min-width: 3.5rem;
      padding: 0.1rem 0 !important; }
    .game-action-button > span {
      font-size: 1.35rem;
      line-height: 1;
    }
    .game-action-button > my-global-icon { color: inherit;
      height: 1.35rem;
      width: 1.35rem; }
    .game-action-button > my-global-icon ::ng-deep svg { stroke-width: 2.1; }
    .game-action-button strong {
      color: inherit;
      font-size: 0.78rem;
      font-weight: 600;
      line-height: 1;
      min-height: 0.8rem;
    }
    .game-action-button small {
      color: var(--game-muted);
      font-size: 0.72rem;
      line-height: 1;
    }
    .game-action-button.active > span,
    .game-action-button.active > my-global-icon,
    .game-action-button.active strong,
    .game-action-button.active small { color: var(--game-brand); }
    .coin-row button.active { background: var(--game-accent-soft);
      border-color: rgb(251 114 153 / 48%);
      color: var(--game-accent-deep); }
    .coin-row { align-items: center;
      border-top: 1px solid var(--game-border);
      margin-top: 1rem;
      padding-top: 1rem; }
    .coin-row span { color: var(--game-muted);
      font-size: 0.82rem;
      margin-right: auto; }
    .coin-row button:last-child { background: var(--game-brand);
      border-color: var(--game-brand);
      color: #fff;
      font-weight: 700; }

    /* Triple Action Button */
    .triple-action {
      position: relative;
      transition: transform 0.3s ease, background-color 0.2s ease;
    }

    .triple-action:not(:disabled) {
      animation: triplePulse 2s ease-in-out infinite;
    }

    .triple-action.animating my-global-icon {
      animation: tripleSpin 0.6s ease-in-out;
    }

    .triple-action.applied {
      background: linear-gradient(135deg, var(--game-brand), #f59e0b) !important;
      border-color: var(--game-brand) !important;
      color: #fff !important;
    }

    .triple-action.applied > span,
    .triple-action.applied > my-global-icon { color: #fff; }
    .triple-action.applied small { color: rgb(255 255 255 / 85%); }

    @keyframes triplePulse {
      0%, 100% { box-shadow: 0 0 0 0 rgb(0 174 236 / 30%); }
      50% { box-shadow: 0 0 0 6px rgb(0 174 236 / 0%); }
    }

    @keyframes tripleSpin {
      0% { transform: rotate(0deg) scale(1); }
      50% { transform: rotate(180deg) scale(1.3); }
      100% { transform: rotate(360deg) scale(1); }
    }

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
    .description-rating {
      align-items: center;
      color: var(--game-muted);
      display: inline-flex;
      font-size: 0.78rem;
      gap: 0.4rem;
    }
    .description-stars {
      align-items: center;
      color: #d0d4da;
      display: inline-flex;
      gap: 0.08rem;
    }
    .description-stars my-global-icon {
      height: 0.9rem;
      width: 0.9rem;
    }
    .description-stars my-global-icon.active {
      color: #ffb400;
    }
    .description-rating strong {
      color: #ff9500;
      font-size: 0.95rem;
      font-weight: 800;
    }
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
      .coin-row { flex-wrap: wrap; gap: 0.5rem; }
      .coin-row span { font-size: 0.75rem; }
    }
  `],
  template: `
    @if (community(); as state) {
      <section class="game-community-panel" aria-label="游戏互动操作">
        <div class="interaction-row">
          <button class="game-action-button" type="button" [class.active]="state.rating === 'like'" (click)="toggleRate()">
            <my-global-icon iconName="like" /><strong>{{ state.likes }}</strong><small>点赞</small>
          </button>
          <button class="game-action-button" type="button" (click)="coinAmount.set(1)">
            <my-global-icon iconName="coin" /><strong>{{ state.coins }}</strong><small>投币</small>
          </button>
          <button class="game-action-button" type="button" [class.active]="state.favorite" (click)="toggleFavorite()">
            <my-global-icon iconName="star" /><strong>{{ state.favorite ? '已' : '' }}</strong><small>收藏</small>
          </button>
          <button class="game-action-button" type="button" [class.active]="inWatchLater" (click)="toggleWatchLater.emit()">
            <my-global-icon iconName="clock" /><strong>{{ inWatchLater ? '已' : '' }}</strong><small>稍后再玩</small>
          </button>
          @if (!state.isOwner) {
            <button class="game-action-button triple-action" type="button" [class.animating]="tripleAnimating()" [class.applied]="tripleApplied()" [disabled]="tripleAnimating()" (click)="tripleAction()">
              <my-global-icon iconName="thumbs-up" /><strong></strong><small>一键三连</small>
            </button>
          }
          <button class="game-action-button" type="button" (click)="share.emit()">
            <my-global-icon iconName="share" /><strong></strong><small>分享</small>
          </button>
        </div>
        @if (actionFeedback()) { <p class="feedback action-feedback" role="status">{{ actionFeedback() }}</p> }
        @if (watchLaterFeedback) { <p class="feedback action-feedback" role="status">{{ watchLaterFeedback }}</p> }
        @if (!state.isOwner) {
          <div class="coin-row">
            <strong>投币</strong>
            <span>余额 {{ state.coinBalance }} · 本游戏已投 {{ state.coinsGiven }}/2</span>
            <button type="button" [class.active]="coinAmount() === 1" (click)="coinAmount.set(1)">1 枚</button>
            <button type="button" [class.active]="coinAmount() === 2" (click)="coinAmount.set(2)">2 枚</button>
            <button type="button" [disabled]="coinLoading()" (click)="giveCoin()">{{ coinLoading() ? '处理中...' : '确认投币' }}</button>
          </div>
        }
        @if (coinMessage()) { <p class="feedback" role="status">{{ coinMessage() }}</p> }

        <section class="game-description-panel" aria-labelledby="game-description-title">
          <div class="description-heading">
            <h2 id="game-description-title">简介</h2>
            <div class="description-rating" aria-label="平均评分">
              <div class="description-stars" aria-hidden="true">
                @for (score of reviewScores; track score) {
                  <my-global-icon iconName="star" [class.active]="score <= roundedAverageScore()" />
                }
              </div>
              <strong>{{ displayAverageScore() > 0 ? displayAverageScore().toFixed(1) : '暂无' }}</strong>
              <span>{{ displayReviewCount() }} 条评价</span>
            </div>
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
  @Input() inWatchLater = false
  @Input() watchLaterFeedback = ''

  @Output() share = new EventEmitter<void>()
  @Output() toggleWatchLater = new EventEmitter<void>()

  readonly reviewScores = [ 1, 2, 3, 4, 5 ]
  readonly coinAmount = signal<1 | 2>(1)
  readonly coinLoading = signal(false)
  readonly coinMessage = signal('')
  readonly actionFeedback = signal('')
  readonly tripleAnimating = signal(false)
  readonly tripleApplied = signal(false)

  readonly displayAverageScore = () => {
    const c = this.community()
    if (c && c.reviews > 0 && c.averageReviewScore > 0) return Number(c.averageReviewScore)
    return 0
  }
  readonly displayReviewCount = () => this.community()?.reviews || 0
  readonly roundedAverageScore = () => Math.round(this.displayAverageScore())

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

  tripleAction () {
    if (!this.requireLogin()) return
    if (this.tripleAnimating() || this.tripleApplied()) return
    this.tripleAnimating.set(true)
    this.actionFeedback.set('')
    this.gamesService.triple(this.uuid).subscribe({
      next: result => {
        this.tripleAnimating.set(false)
        this.tripleApplied.set(result.liked || result.coined || result.favorited)

        const messages: string[] = []
        if (result.liked) messages.push('点赞')
        if (result.coined) messages.push('投币')
        if (result.favorited) messages.push('收藏')
        this.actionFeedback.set('一键三连' + (messages.length ? '：' + messages.join(' + ') : '已完成'))

        this.gamesService.community(this.uuid).subscribe({
          next: value => this.community.set(value)
        })
      },
      error: error => {
        this.tripleAnimating.set(false)
        this.actionFeedback.set(getGameActionErrorMessage(error))
      }
    })
  }

  giveCoin () {
    if (!this.requireLogin()) return
    const state = this.community()
    if (!state || this.coinLoading()) return
    this.coinLoading.set(true)
    this.coinMessage.set('')
    this.gamesService.coin(this.uuid, this.coinAmount()).subscribe({
      next: value => {
        this.coinLoading.set(false)
        this.coinMessage.set(`投币成功，已投入 ${value.coinsGiven} 枚，余额 ${value.coinBalance} 枚`)
        this.community.update(current => current
          ? { ...current, coins: current.coins + this.coinAmount(), coinBalance: value.coinBalance, coinsGiven: value.coinsGiven }
          : current)
      },
      error: error => {
        this.coinLoading.set(false)
        this.coinMessage.set(getGameActionErrorMessage(error))
      }
    })
  }

  private requireLogin () {
    if (this.authService.isLoggedIn()) return true
    void this.router.navigate([ '/login' ], { queryParams: { returnUrl: this.router.url } })
    return false
  }
}
