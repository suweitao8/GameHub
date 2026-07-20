import { Component, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { HttpClient } from '@angular/common/http'
import { environment } from '../../environments/environment'
import { AuthService } from '@app/core/auth/auth.service'
import { GameCardComponent } from './game-card.component'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { buildGameAvatarDataUrl } from '../shared/game-avatar'

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
  imports: [CommonModule, RouterLink, GlobalIconComponent],
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
                  <button type="button" class="event-action-btn secondary" (click)="leaveEvent()">取消报名</button>
                } @else {
                  <button type="button" class="event-action-btn primary" (click)="joinEvent()">{{ ev.maxParticipants > 0 && ev.participantCount >= ev.maxParticipants ? '名额已满' : '立即报名' }}</button>
                }
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
                <div class="participant-skeleton shimmer" *ngFor="let _ of [1,2,3]"></div>
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
          <a routerLink="/games/events">返回活动列表</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .event-detail-container { max-width: 900px; margin: 0 auto; padding: 1rem; }

    .event-detail-header {
      background: #fff;
      border: 1px solid var(--game-border);
      border-radius: var(--game-radius);
      margin-bottom: 1.5rem;
      overflow: hidden;
    }

    .event-detail-header.has-cover { display: grid; grid-template-columns: 1fr 1fr; }
    @media (max-width: 720px) { .event-detail-header.has-cover { grid-template-columns: 1fr; } }

    .event-detail-cover { aspect-ratio: 16 / 9; overflow: hidden; }
    .event-detail-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .event-detail-info { padding: 1.25rem; }

    .event-detail-badges { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }

    .event-type-badge, .event-status-badge {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .event-type-badge.activity { background: #e0f2fe; color: #0369a1; }
    .event-type-badge.competition { background: #fef3c7; color: #92400e; }

    .event-status-badge.upcoming { background: #dcfce7; color: #166534; }
    .event-status-badge.ongoing { background: #dbeafe; color: #1e40af; }
    .event-status-badge.ended { background: #f3f4f6; color: #4b5563; }
    .event-status-badge.cancelled { background: #fee2e2; color: #991b1b; }

    .event-detail-info h1 { font-size: 1.5rem; margin: 0 0 0.5rem; }
    .event-desc { color: var(--game-muted); font-size: 0.9rem; margin: 0 0 1rem; }

    .event-meta-bar {
      display: flex;
      gap: 1rem;
      color: var(--game-muted);
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }

    .event-meta-bar span { display: inline-flex; align-items: center; gap: 0.3rem; }
    .event-meta-bar my-global-icon { height: 0.9rem; width: 0.9rem; }

    .event-actions { display: flex; gap: 0.75rem; }

    .event-action-btn {
      align-items: center;
      border: 1px solid var(--game-border);
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      font-size: 0.9rem;
      font-weight: 700;
      gap: 0.35rem;
      padding: 0.6rem 1.25rem;
      transition: background-color 160ms ease, border-color 160ms ease;
    }

    .event-action-btn.primary { background: var(--game-brand); border-color: var(--game-brand); color: #fff; }
    .event-action-btn.primary:hover { background: var(--game-brand-deep); }
    .event-action-btn.primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .event-action-btn.secondary { background: #fff; color: var(--game-muted); }
    .event-action-btn.secondary:hover { background: #f1f2f3; }

    .event-detail-body { display: flex; flex-direction: column; gap: 1rem; }

    .event-detail-section {
      background: #fff;
      border: 1px solid var(--game-border);
      border-radius: var(--game-radius);
      padding: 1.25rem;
    }

    .event-detail-section h2 { font-size: 1.1rem; margin: 0 0 0.75rem; }

    .event-rules, .event-prizes {
      color: var(--game-text);
      font-size: 0.88rem;
      line-height: 1.7;
      white-space: pre-wrap;
    }

    .participants-list { display: flex; flex-direction: column; gap: 0.5rem; }

    .participant-item {
      align-items: center;
      display: flex;
      gap: 0.75rem;
      padding: 0.5rem 0;
    }

    .participant-avatar {
      flex: 0 0 auto;
      height: 2rem;
      width: 2rem;
      border-radius: 50%;
      overflow: hidden;
      background: var(--game-brand-soft);
    }

    .participant-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .participant-info { display: flex; align-items: center; gap: 0.5rem; }
    .participant-info strong { font-size: 0.88rem; }
    .participant-state {
      background: #e0f2fe;
      color: #0369a1;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.1rem 0.4rem;
      border-radius: 3px;
      text-transform: uppercase;
    }

    .participants-empty { color: var(--game-muted); font-size: 0.85rem; text-align: center; padding: 2rem; margin: 0; }

    .event-not-found { text-align: center; padding: 3rem; }
    .event-not-found h1 { font-size: 1.3rem; margin-bottom: 0.5rem; }
    .event-not-found p { color: var(--game-muted); margin: 0 0 1rem; }
    .event-not-found a { color: var(--game-brand); text-decoration: none; font-weight: 700; }
    .event-not-found a:hover { text-decoration: underline; }

    .event-detail-skeleton { display: flex; flex-direction: column; gap: 1rem; }
    .event-skeleton-cover { aspect-ratio: 16 / 9; border-radius: var(--game-radius); }
    .event-skeleton-title { height: 2rem; width: 60%; border-radius: 4px; }
    .event-skeleton-text { height: 1rem; width: 40%; border-radius: 4px; }
    .participants-skeleton { display: flex; flex-direction: column; gap: 0.5rem; }
    .participant-skeleton { height: 2.5rem; border-radius: 4px; }
  `]
})
export class GameEventDetailComponent implements OnInit {
  private readonly http = inject(HttpClient)
  private readonly route = inject(ActivatedRoute)
  private readonly authService = inject(AuthService)
  event = signal<GameEventDetail | null>(null)
  loading = signal(false)
  participants = signal<EventParticipant[]>([])
  participantsLoading = signal(false)
  joined = signal(false)

  ngOnInit () {
    this.route.paramMap.subscribe(params => {
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
    this.loading.set(true)
    this.http.get<GameEventDetail>(`${environment.apiUrl}/api/v1/games/events/${slug}`).subscribe({
      next: (result) => {
        this.event.set(result)
        this.loading.set(false)
      },
      error: () => {
        this.loading.set(false)
      }
    })
  }

  loadParticipants (slug: string) {
    this.participantsLoading.set(true)
    this.http.get<{ total: number; data: EventParticipant[] }>(`${environment.apiUrl}/api/v1/games/events/${slug}/participants`).subscribe({
      next: (result) => {
        this.participants.set(result.data)
        this.participantsLoading.set(false)
      },
      error: () => this.participantsLoading.set(false)
    })
  }

  checkJoined (slug: string) {
    // Simplified: check by seeing if current user is in participants
    this.http.get<{ total: number; data: EventParticipant[] }>(`${environment.apiUrl}/api/v1/games/events/${slug}/participants`).subscribe({
      next: (result) => {
        const currentAccountId = this.authService.getUser()?.account?.id
        const isJoined = result.data.some(p => p.account.id === currentAccountId)
        this.joined.set(isJoined)
      },
      error: () => {}
    })
  }

  joinEvent () {
    const slug = this.event()?.slug
    if (!slug) return
    this.http.post<{ joined: boolean }>(`${environment.apiUrl}/api/v1/games/events/${slug}/join`, {}).subscribe({
      next: () => {
        this.joined.set(true)
        this.event.update(ev => ev ? { ...ev, participantCount: ev.participantCount + 1 } : ev)
        this.loadParticipants(slug)
      },
      error: () => {}
    })
  }

  leaveEvent () {
    const slug = this.event()?.slug
    if (!slug) return
    this.http.delete(`${environment.apiUrl}/api/v1/games/events/${slug}/join`).subscribe({
      next: () => {
        this.joined.set(false)
        this.event.update(ev => ev ? { ...ev, participantCount: Math.max(0, ev.participantCount - 1) } : ev)
        this.loadParticipants(slug)
      },
      error: () => {}
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
