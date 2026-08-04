import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { HttpClient } from '@angular/common/http'
import { map } from 'rxjs/operators'
import { environment } from '../../environments/environment'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { createAsyncState } from './shared'

export type GameEvent = {
  id: number
  title: string
  description: string | null
  slug: string
  type: 'activity' | 'competition'
  status: 'upcoming' | 'ongoing' | 'ended' | 'cancelled'
  coverPath: string | null
  startAt: string | null
  endAt: string | null
  maxParticipants: number
  participantCount: number
  createdBy: { id: number; name: string; displayName: string } | null
  createdAt: string
}

@Component({
  selector: 'my-game-events',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, GlobalIconComponent],
  template: `
    <div class="events-container">
      <div class="events-header">
        <h2>社区活动与比赛</h2>
        <p>和玩家一起参加活动、交流玩法，发现新的挑战。</p>
        <div class="events-filters">
          @for (filter of filters; track filter.id) {
            <button [class.active]="currentFilter() === filter.id" (click)="setFilter(filter.id)">{{ filter.label }}</button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="events-skeleton">
          @for (i of [1,2,3]; track $index) { <div class="event-card shimmer"></div> }
        </div>
      } @else if (filteredEvents().length) {
        <div class="events-grid">
          @for (event of filteredEvents(); track event.id) {
            <a class="event-card" [routerLink]="['/games/event', event.slug]">
              <div class="event-cover">
                @if (event.coverPath) {
                  <img [src]="event.coverPath" [alt]="event.title" loading="lazy">
                } @else {
                  <div class="event-cover-placeholder">{{ event.title.charAt(0) }}</div>
                }
              </div>
              <div class="event-info">
                <span class="event-type" [class]="event.type">{{ eventTypeLabel(event.type) }}</span>
                <span class="event-status" [class]="event.status">{{ eventStatusLabel(event.status) }}</span>
                <h3>{{ event.title }}</h3>
                @if (event.description) { <p>{{ event.description }}</p> }
                <div class="event-meta">
                  <span><my-global-icon iconName="calendar" />{{ event.startAt | date:'MM-dd' }}</span>
                  <span><my-global-icon iconName="users" />{{ event.participantCount }} / {{ event.maxParticipants || '∞' }}</span>
                </div>
              </div>
            </a>
          }
        </div>
      } @else {
        <div class="events-empty">
          <span>暂无进行中的活动</span>
          <p>关注社区动态，第一时间获取活动信息</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .events-container { max-width: 1200px; margin: 0 auto; padding: 1rem; }

    .events-header { margin-bottom: 1.5rem; }
    .events-header h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .events-header p { color: var(--game-muted); font-size: 0.9rem; margin: 0; }

    .events-filters {
      display: flex;
      gap: 0.35rem;
      margin-top: 1rem;
    }

    .events-filters button {
      background: #fff;
      border: 1px solid var(--game-border);
      border-radius: 6px;
      color: var(--game-muted);
      cursor: pointer;
      font-size: 0.82rem;
      font-weight: 600;
      padding: 0.4rem 0.85rem;
      transition: all 160ms ease;
    }

    .events-filters button:hover {
      background: #f0f2f4;
      color: var(--game-text);
    }

    .events-filters button.active {
      background: var(--game-brand);
      border-color: var(--game-brand);
      color: #fff;
    }

    .events-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .event-card {
      background: #fff;
      border: 1px solid var(--game-border);
      border-radius: var(--game-radius);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      transition: border-color 160ms ease, box-shadow 160ms ease;
    }

    .event-card:hover {
      border-color: var(--game-brand);
      box-shadow: var(--game-shadow);
    }

    .event-cover { width: 100%; aspect-ratio: 16 / 9; overflow: hidden; }
    .event-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .event-cover-placeholder {
      width: 100%;
      aspect-ratio: 16 / 9;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--game-brand-soft);
      color: var(--game-brand-deep);
      font-size: 2.5rem;
      font-weight: 700;
    }

    .event-info { padding: 0.75rem; }

    .event-type, .event-status {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      margin-right: 0.35rem;
      text-transform: uppercase;
    }

    .event-type.activity { background: #e0f2fe; color: #0369a1; }
    .event-type.competition { background: #fef3c7; color: #92400e; }

    .event-status.upcoming { background: #dcfce7; color: #166534; }
    .event-status.ongoing { background: #dbeafe; color: #1e40af; }
    .event-status.ended { background: #f3f4f6; color: #4b5563; }
    .event-status.cancelled { background: #fee2e2; color: #991b1b; }

    .event-info h3 { font-size: 1rem; margin: 0.5rem 0 0.25rem; }
    .event-info p { color: var(--game-muted); font-size: 0.8rem; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    .event-meta {
      display: flex;
      gap: 1rem;
      margin-top: 0.75rem;
      font-size: 0.78rem;
      color: var(--game-muted);
    }

    .event-meta span { display: inline-flex; align-items: center; gap: 0.25rem; }
    .event-meta my-global-icon { height: 0.8rem; width: 0.8rem; }

    .events-empty { text-align: center; padding: 3rem; color: var(--game-muted); }
    .events-empty span { display: block; font-size: 1.1rem; margin-bottom: 0.5rem; }
    .events-empty p { font-size: 0.82rem; margin: 0; }

    .events-skeleton { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .events-skeleton .event-card { height: 200px; }
  `]
})
export class GameEventsComponent implements OnInit {
  private readonly http = inject(HttpClient)
  private readonly route = inject(ActivatedRoute)
  readonly eventsState = createAsyncState<GameEvent[]>()
  /** 模板兼容：直接返回 data，空数组兜底 */
  readonly events = computed(() => this.eventsState.data() ?? [])
  /** 模板兼容：底层 state 的 loading 别名 */
  readonly loading = this.eventsState.loading
  currentFilter = signal<'all' | 'upcoming' | 'ongoing' | 'ended'>('all')

  filters = [
    { id: 'all' as const, label: '全部' },
    { id: 'upcoming' as const, label: '即将开始' },
    { id: 'ongoing' as const, label: '进行中' },
    { id: 'ended' as const, label: '已结束' }
  ]

  filteredEvents = computed(() => {
    const filter = this.currentFilter()
    if (filter === 'all') return this.events()
    return this.events().filter(e => e.status === filter)
  })

  ngOnInit () {
    const data$ = this.http.get<{ total: number; data: GameEvent[] }>(`${environment.apiUrl}/api/v1/games/events`).pipe(
      map(result => result.data)
    )
    this.eventsState.load(data$)
  }

  setFilter (filter: 'all' | 'upcoming' | 'ongoing' | 'ended') {
    this.currentFilter.set(filter)
  }

  eventTypeLabel (type: string) {
    return type === 'activity' ? '活动' : '比赛'
  }

  eventStatusLabel (status: string) {
    const labels: Record<string, string> = {
      upcoming: '即将开始',
      ongoing: '进行中',
      ended: '已结束',
      cancelled: '已取消'
    }
    return labels[status] || status
  }
}
