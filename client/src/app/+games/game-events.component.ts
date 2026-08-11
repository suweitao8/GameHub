import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { map } from 'rxjs/operators'
import { GamesService } from './games.service'
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
            <button type="button" [class.active]="currentFilter() === filter.id" (click)="setFilter(filter.id)">{{ filter.label }}</button>
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
  styleUrl: './game-events.component.scss'
})
export class GameEventsComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
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
    const data$ = this.gamesService.listEvents().pipe(
      map(result => result.data as unknown as GameEvent[])
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
