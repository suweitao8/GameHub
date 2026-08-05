import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import type { GameAnalytics } from './games.service'
import { GamesService } from './games.service'
import { AnalyticsKpiGridComponent } from './analytics/analytics-kpi-grid.component'
import { PlayTrendChartComponent } from './analytics/play-trend-chart.component'
import { InteractionBreakdownComponent } from './analytics/interaction-breakdown.component'
import { FollowerGrowthChartComponent } from './analytics/follower-growth-chart.component'
import { TopGamesRankingComponent } from './analytics/top-games-ranking.component'

type TimeRange = '7d' | '30d' | '90d'

@Component({
  selector: 'my-game-analytics-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    GlobalIconComponent,
    AnalyticsKpiGridComponent,
    PlayTrendChartComponent,
    InteractionBreakdownComponent,
    FollowerGrowthChartComponent,
    TopGamesRankingComponent
  ],
  template: `
    <div class="analytics-dashboard">
      <div class="analytics-header">
        <div>
          <h2>创作者数据中心</h2>
          <p class="analytics-subtitle">追踪你的作品表现和粉丝增长</p>
        </div>
        <div class="analytics-actions">
          <div class="time-range-selector">
            @for (range of timeRanges; track range.id) {
              <button [class.active]="currentRange() === range.id" (click)="setTimeRange(range.id)">{{ range.label }}</button>
            }
          </div>
          <button class="export-btn" (click)="exportData()" [disabled]="exporting()">
            <my-global-icon iconName="download" />{{ exporting() ? '导出中...' : '导出数据' }}
          </button>
        </div>
      </div>

      @if (analytics(); as data) {
        <my-analytics-kpi-grid [kpis]="kpis()" />

        <div class="analytics-grid">
          <my-play-trend-chart [playTrend]="data.playTrend" [rangeLabel]="currentRangeLabel()" />
          <my-interaction-breakdown [interactionBreakdown]="data.interactionBreakdown" />
          <my-follower-growth-chart [followerTrend]="data.followerTrend" [totalFollowers]="kpis().totalFollowers" />
          <my-top-games-ranking [gameRanking]="data.gameRanking" />
        </div>
      } @else {
        <div class="analytics-loading">
          <div class="loading-skeleton">
            <div class="skeleton-kpi-grid">
              @for (i of [1,2,3,4]; track $index) { <div class="skeleton-kpi shimmer"></div> }
            </div>
            <div class="skeleton-chart shimmer"></div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './game-analytics-dashboard.component.scss'
})
export class GameAnalyticsDashboardComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  readonly analytics = signal<GameAnalytics | null>(null)
  readonly currentRange = signal<TimeRange>('30d')
  readonly exporting = signal(false)

  readonly timeRanges = [
    { id: '7d' as TimeRange, label: '7天' },
    { id: '30d' as TimeRange, label: '30天' },
    { id: '90d' as TimeRange, label: '90天' }
  ]

  ngOnInit () {
    this.loadAnalytics()
  }

  loadAnalytics () {
    this.gamesService.getAnalytics(this.currentRange()).subscribe(data => this.analytics.set(data))
  }

  setTimeRange (range: TimeRange) {
    this.currentRange.set(range)
    this.loadAnalytics()
  }

  currentRangeLabel (): string {
    const labels: Record<TimeRange, string> = { '7d': '近7天', '30d': '近30天', '90d': '近90天' }
    return labels[this.currentRange()]
  }

  readonly kpis = computed(() => {
    const data = this.analytics()
    if (!data) {
      return {
        totalPlays: 0,
        totalLikes: 0,
        totalFollowers: 0,
        totalCoins: 0,
        playsTrend: 0,
        likesTrend: 0,
        followersTrend: 0,
        coinsTrend: 0
      }
    }

    const totalPlays = data.playTrend.reduce((sum, t) => sum + t.plays, 0)
    const totalLikes = data.interactionBreakdown.likes
    const totalFollowers = data.followerTrend[data.followerTrend.length - 1]?.followers || 0
    const totalCoins = data.interactionBreakdown.coins

    // Calculate simple trend (last period vs previous period)
    const mid = Math.floor(data.playTrend.length / 2)
    const previousPlays = data.playTrend.slice(0, mid).reduce((sum, item) => sum + item.plays, 0)
    const recentPlays = data.playTrend.slice(mid).reduce((sum, item) => sum + item.plays, 0)
    const playsTrend = data.playTrend.length > 1
      ? Math.round(((recentPlays - previousPlays) / Math.max(previousPlays, 1)) * 100)
      : 0

    return { totalPlays, totalLikes, totalFollowers, totalCoins, playsTrend, likesTrend: 0, followersTrend: 0, coinsTrend: 0 }
  })

  exportData () {
    const data = this.analytics()
    if (!data) return
    this.exporting.set(true)

    // Build CSV
    const csvRows = [
      [ '日期', '播放量' ],
      ...data.playTrend.map(t => [ t.date, String(t.plays) ])
    ]
    const csv = csvRows.map(row => row.join(',')).join('\n')
    const blob = new Blob([ csv ], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)

    setTimeout(() => this.exporting.set(false), 500)
  }
}
