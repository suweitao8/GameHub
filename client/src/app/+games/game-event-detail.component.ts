import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ActivatedRoute } from '@angular/router'
import { HttpClient } from '@angular/common/http'
import { map } from 'rxjs/operators'
import { environment } from '../../environments/environment'
import { AuthService } from '@app/core/auth/auth.service'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { buildGameAvatarDataUrl } from '../shared/game-avatar'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { createAsyncState } from './shared'

export type GameEventDetail = {
  id: number
  title: string
  description: string | null
  slug: string
  type: 'activity' | 'competition'
  status: 'upcoming' | 'ongoing' | 'ended' | 'cancelled'
  coverPath: string | null
  startAt: string | null
  endAt: string | null
  rules: string | null
  prizes: string | null
  maxParticipants: number
  participantCount: number
  createdBy: { id: number; name: string; displayName: string } | null
  createdAt: string
}

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
                  <button type="button" class="event-action-btn secondary" [disabled]="joinLoading()" (click)="leaveEvent()">
                    {{ joinLoading() ? '处理中…' : '取消报名' }}
                  </button>
                } @else {
                  <button type="button" class="event-action-btn primary" [disabled]="joinLoading() || (ev.maxParticipants > 0 && ev.participantCount >= ev.maxParticipants)" (click)="joinEvent()">
                    {{ joinLoading() ? '处理中…' : ev.maxParticipants > 0 && ev.participantCount >= ev.maxParticipants ? '名额已满' : '立即报名' }}
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
            <h2 id="participants-title">已报名 {{ participants().length }} 人</h2>
            @if (participantsLoading()) {
              <div class="participants-skeleton">
                @for (_ of [1, 2, 3]; track $index) {
                  <div class="participant-skeleton shimmer"></div>
                }
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
  private readonly authService = inject(AuthService)
  private readonly destroyRef = inject(DestroyRef)
  readonly eventState = createAsyncState<GameEventDetail>()
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
  actionFeedback = signal('')

  ngOnInit () {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const slug = params.get('slug')
        if (!slug) return
        this.loadEvent(slug)
        this.loadParticipants(slug)
        if (this.authService.isLoggedIn()) {
          this.checkJoined(slug)
        }
      })
  }

  loadEvent (slug: string) {
    this.eventState.load(this.http.get<GameEventDetail>(`${environment.apiUrl}/api/v1/games/events/${slug}`))
  }

  loadParticipants (slug: string) {
    const data$ = this.http.get<{ total: number; data: EventParticipant[] }>(`${environment.apiUrl}/api/v1/games/events/${slug}/participants`).pipe(
      map(result => result.data)
    )
    this.participantsState.load(data$)
  }

  checkJoined (slug: string) {
    // Simplified: check by seeing if current user is in participants.
    // 失败时 joined 保持默认 false（非阻塞辅助检测），用户仍可点击加入按钮重试。
    this.http.get<{ total: number; data: EventParticipant[] }>(`${environment.apiUrl}/api/v1/games/events/${slug}/participants`).subscribe({
      next: (result) => {
        const currentAccountId = this.authService.getUser()?.account?.id
        const isJoined = result.data.some(p => p.account.id === currentAccountId)
        this.joined.set(isJoined)
      },
      error: () => { /* 非阻塞：保持默认未加入状态，joinEvent 会给出具体反馈 */ }
    })
  }

  joinEvent () {
    const slug = this.event()?.slug
    if (!slug) return
    this.joinLoading.set(true)
    this.actionFeedback.set('')
    this.http.post<{ joined: boolean }>(`${environment.apiUrl}/api/v1/games/events/${slug}/join`, {}).subscribe({
      next: () => {
        this.joined.set(true)
        this.joinLoading.set(false)
        this.eventState.data.update(ev => ev ? { ...ev, participantCount: ev.participantCount + 1 } : ev)
        this.loadParticipants(slug)
      },
      error: () => {
        this.joinLoading.set(false)
        this.actionFeedback.set('加入失败，请稍后重试')
      }
    })
  }

  leaveEvent () {
    const slug = this.event()?.slug
    if (!slug) return
    this.joinLoading.set(true)
    this.actionFeedback.set('')
    this.http.delete(`${environment.apiUrl}/api/v1/games/events/${slug}/join`).subscribe({
      next: () => {
        this.joined.set(false)
        this.joinLoading.set(false)
        this.eventState.data.update(ev => ev ? { ...ev, participantCount: Math.max(0, ev.participantCount - 1) } : ev)
        this.loadParticipants(slug)
      },
      error: () => {
        this.joinLoading.set(false)
        this.actionFeedback.set('退出失败，请稍后重试')
      }
    })
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

  formatDate (date: string | null) {
    if (!date) return '待定'
    return new Date(date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  getAvatarUrl (account: { displayName: string; name: string }) {
    return buildGameAvatarDataUrl(account.displayName || account.name || '用')
  }
}
