import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ActivatedRoute, Router } from '@angular/router'
import { HttpClient, HttpErrorResponse } from '@angular/common/http'
import { map } from 'rxjs/operators'
import { environment } from '../../environments/environment'
import { AuthService } from '@app/core/auth/auth.service'
import { LoginModalService } from '@app/+login/login-modal.service'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { buildGameAvatarDataUrl } from '../shared/game-avatar'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { createAsyncState } from './shared'
import { GamesService, type GameEvent, type GameEventJoinResult } from './games.service'

export type EventParticipant = {
  id: number
  account: { id: number; name: string; displayName: string }
  state: 'registered' | 'submitted' | 'winner' | 'disqualified'
  rank: number | null
  createdAt: string
}

@Component({
  selector: 'my-game-event-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ CommonModule, GlobalIconComponent ],
  template: `
    <div class="event-detail-container">
      @if (loading()) {
        <div class="event-detail-skeleton">
          <div class="event-skeleton-cover shimmer"></div>
          <div class="event-skeleton-title shimmer"></div>
          <div class="event-skeleton-text shimmer"></div>
        </div>
      } @else if (eventState.hasError()) {
        <div class="event-state" role="alert">
          <h1>活动加载失败</h1>
          <p>{{ eventState.error() || '请稍后重试。' }}</p>
          <button type="button" class="event-action-btn primary" (click)="retryLoad()">重新加载</button>
        </div>
      } @else if (event(); as ev) {
        <div class="event-detail-header" [class.has-cover]="ev.coverPath">
          @if (ev.coverPath) {
            <div class="event-detail-cover"><img [src]="ev.coverPath" [alt]="ev.title" loading="eager"></div>
          }
          <div class="event-detail-info">
            <div class="event-detail-badges">
              <span class="event-type-badge" [class]="ev.type">{{ typeLabel(ev.type) }}</span>
              <span class="event-status-badge" [class]="ev.status">{{ statusLabel(ev.status) }}</span>
            </div>
            <h1>{{ ev.title }}</h1>
            @if (ev.description) { <p class="event-desc">{{ ev.description }}</p> }
            <div class="event-meta-bar">
              <span><my-global-icon iconName="calendar" />{{ formatDate(ev.startAt) }} - {{ formatDate(ev.endAt) }}</span>
              <span><my-global-icon iconName="users" />{{ ev.participantCount }} / {{ ev.maxParticipants || '∞' }} 人</span>
            </div>
            <div class="event-actions">
              @if (ev.status === 'upcoming' || ev.status === 'ongoing') {
                @if (joined()) {
                  <button type="button" class="event-action-btn secondary"
                          [disabled]="joinLoading() || participationLoading()" (click)="leaveEvent()">
                    {{ joinLoading() ? '处理中…' : '取消报名' }}
                  </button>
                } @else {
                  <button type="button" class="event-action-btn primary"
                          [disabled]="joinLoading() || participationLoading() || isEventFull(ev)" (click)="joinEvent()">
                    {{ joinLoading() || participationLoading() ? '处理中…' : isEventFull(ev) ? '名额已满' : '立即报名' }}
                  </button>
                }
                @if (actionFeedback()) { <p class="event-action-feedback" role="alert">{{ actionFeedback() }}</p> }
              }
            </div>
          </div>
        </div>

        <div class="event-detail-body">
          @if (ev.rules) {
            <section class="event-detail-section">
              <h2>活动规则</h2>
              <div class="event-rules">{{ ev.rules }}</div>
            </section>
          }
          @if (ev.prizes) {
            <section class="event-detail-section">
              <h2>奖品设置</h2>
              <div class="event-prizes">{{ ev.prizes }}</div>
            </section>
          }

          <section class="event-detail-section" aria-labelledby="participants-title">
            <h2 id="participants-title">已报名 {{ ev.participantCount }} 人</h2>
            @if (participantsLoading()) {
              <div class="participants-skeleton">
                @for (_ of [1, 2, 3]; track $index) {
                  <div class="participant-skeleton shimmer"></div>
                }
              </div>
            } @else if (participantsState.hasError()) {
              <div class="participants-error" role="alert">
                <p>{{ participantsState.error() || '报名列表加载失败。' }}</p>
                <button type="button" class="event-action-btn secondary" (click)="retryParticipants()">重新加载</button>
              </div>
            } @else if (participants().length) {
              <div class="participants-list">
                @for (p of participants(); track p.id) {
                  <div class="participant-item">
                    <div class="participant-avatar"><img [src]="getAvatarUrl(p.account)" [alt]="p.account.displayName"></div>
                    <div class="participant-info">
                      <strong>{{ p.account.displayName }}</strong>
                      <span class="participant-state">{{ stateLabel(p.state) }}</span>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <p class="participants-empty">还没有人报名，快来参加吧！</p>
            }
          </section>
        </div>
      } @else {
        <div class="event-not-found">
          <h1>活动不存在</h1>
          <p>该活动可能已被删除或尚未开始</p>
        </div>
      }
    </div>
  `,
  styleUrl: './game-event-detail.component.scss'
})
export class GameEventDetailComponent implements OnInit {
  private readonly http = inject(HttpClient)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly authService = inject(AuthService)
  private readonly loginModalService = inject(LoginModalService)
  private readonly gamesService = inject(GamesService)
  private readonly destroyRef = inject(DestroyRef)
  readonly eventState = createAsyncState<GameEvent>()
  /** 模板兼容：直接返回 data（null 时进入 not-found 分支） */
  readonly event = computed(() => this.eventState.data())
  /** 模板兼容：底层 state 的 loading 别名 */
  readonly loading = this.eventState.loading
  readonly participantsState = createAsyncState<EventParticipant[]>()
  /** 模板兼容：直接返回 data，空数组兜底 */
  readonly participants = computed(() => this.participantsState.data() ?? [])
  readonly participantsLoading = this.participantsState.loading
  joined = signal(false)
  joinLoading = signal(false)
  participationLoading = signal(false)
  actionFeedback = signal('')
  private currentSlug = ''

  ngOnInit () {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const slug = params.get('slug')
        if (!slug) return
        this.currentSlug = slug
        this.loadEvent(slug)
        this.loadParticipants(slug)
        this.joined.set(false)
        this.participationLoading.set(false)
        this.actionFeedback.set('')
        if (this.authService.isLoggedIn()) {
          this.loadParticipation(slug)
        }
      })
  }

  loadEvent (slug: string) {
    this.eventState.load(this.gamesService.getEvent(slug))
  }

  loadParticipants (slug: string) {
    const data$ = this.http.get<{ total: number; data: EventParticipant[] }>(
      `${environment.apiUrl}/api/v1/games/events/${encodeURIComponent(slug)}/participants`
    ).pipe(
      map(result => result.data)
    )
    this.participantsState.load(data$)
  }

  retryLoad () {
    if (!this.currentSlug) return
    this.loadEvent(this.currentSlug)
    this.loadParticipants(this.currentSlug)
    if (this.authService.isLoggedIn()) this.loadParticipation(this.currentSlug)
  }

  retryParticipants () {
    if (this.currentSlug) this.loadParticipants(this.currentSlug)
  }

  loadParticipation (slug: string) {
    this.participationLoading.set(true)
    this.gamesService.getEventParticipation(slug).subscribe({
      next: result => {
        this.joined.set(result.joined)
        this.participationLoading.set(false)
      },
      error: () => {
        this.participationLoading.set(false)
        this.actionFeedback.set('报名状态加载失败，请刷新后重试')
      }
    })
  }

  joinEvent () {
    const slug = this.event()?.slug
    if (!slug) return

    if (!this.authService.isLoggedIn()) {
      this.loginModalService.open({ returnUrl: this.router.url, inPlace: true })
      return
    }

    this.joinLoading.set(true)
    this.actionFeedback.set('')
    this.gamesService.joinEvent(slug).subscribe({
      next: result => {
        this.joined.set(true)
        this.joinLoading.set(false)
        this.applyParticipantCount(result)
        this.loadParticipants(slug)
      },
      error: error => {
        this.joinLoading.set(false)
        this.actionFeedback.set(this.getEventActionError(error, '报名失败，请稍后重试'))
      }
    })
  }

  leaveEvent () {
    const slug = this.event()?.slug
    if (!slug) return
    this.joinLoading.set(true)
    this.actionFeedback.set('')
    this.gamesService.leaveEvent(slug).subscribe({
      next: result => {
        this.joined.set(false)
        this.joinLoading.set(false)
        this.applyParticipantCount(result)
        this.loadParticipants(slug)
      },
      error: error => {
        this.joinLoading.set(false)
        this.actionFeedback.set(this.getEventActionError(error, '取消报名失败，请稍后重试'))
      }
    })
  }

  private applyParticipantCount (result: GameEventJoinResult) {
    this.eventState.data.update(event => event ? { ...event, participantCount: result.participantCount } : event)
  }

  private getEventActionError (error: unknown, fallback: string) {
    if (!(error instanceof HttpErrorResponse)) return fallback

    const message = error.error?.error
    if (message === 'Event is full') return '报名人数已满'
    if (message === 'Already joined') return '你已报名该活动'
    if (message === 'Event is not open for registration') return '该活动当前不可报名'
    if (error.status === 404) return '活动或报名记录不存在'
    return fallback
  }

  typeLabel (type: string) {
    return type === 'activity' ? '活动' : '比赛'
  }

  statusLabel (status: string) {
    const labels: Record<string, string> = {
      upcoming: '即将开始',
      ongoing: '进行中',
      ended: '已结束',
      cancelled: '已取消'
    }
    return labels[status] || status
  }

  stateLabel (state: string) {
    const labels: Record<string, string> = {
      registered: '已报名',
      submitted: '已提交',
      winner: '获奖',
      disqualified: '取消资格'
    }
    return labels[state] || state
  }

  isEventFull (event: GameEvent) {
    return event.maxParticipants > 0 && event.participantCount >= event.maxParticipants
  }

  formatDate (date: string | null) {
    if (!date) return '待定'
    return new Date(date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  getAvatarUrl (account: { displayName: string; name: string }) {
    return buildGameAvatarDataUrl(account.displayName || account.name || '用')
  }
}
