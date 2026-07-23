import { Component, inject, signal, OnInit, computed } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink } from '@angular/router'
import type { GameAnalytics } from './games.service'
import { GamesService } from './games.service'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

type TimeRange = '7d' | '30d' | '90d'

@Component({
  selector: 'my-game-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, GlobalIconComponent],
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
        <!-- 关键指标卡片 -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon plays"><my-global-icon iconName="play" /></div>
            <div class="kpi-data">
              <span class="kpi-value">{{ formatNumber(kpis().totalPlays) }}</span>
              <span class="kpi-label">总游玩</span>
              <span class="kpi-trend" [class.up]="kpis().playsTrend > 0" [class.down]="kpis().playsTrend < 0">
                {{ kpis().playsTrend > 0 ? '+' : '' }}{{ kpis().playsTrend }}% 环比
              </span>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon likes"><my-global-icon iconName="like" /></div>
            <div class="kpi-data">
              <span class="kpi-value">{{ formatNumber(kpis().totalLikes) }}</span>
              <span class="kpi-label">总点赞</span>
              <span class="kpi-trend" [class.up]="kpis().likesTrend > 0" [class.down]="kpis().likesTrend < 0">
                {{ kpis().likesTrend > 0 ? '+' : '' }}{{ kpis().likesTrend }}% 环比
              </span>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon followers"><my-global-icon iconName="users" /></div>
            <div class="kpi-data">
              <span class="kpi-value">{{ formatNumber(kpis().totalFollowers) }}</span>
              <span class="kpi-label">总粉丝</span>
              <span class="kpi-trend" [class.up]="kpis().followersTrend > 0" [class.down]="kpis().followersTrend < 0">
                {{ kpis().followersTrend > 0 ? '+' : '' }}{{ kpis().followersTrend }}% 环比
              </span>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon coins"><my-global-icon iconName="coin" /></div>
            <div class="kpi-data">
              <span class="kpi-value">{{ formatNumber(kpis().totalCoins) }}</span>
              <span class="kpi-label">总投币</span>
              <span class="kpi-trend" [class.up]="kpis().coinsTrend > 0" [class.down]="kpis().coinsTrend < 0">
                {{ kpis().coinsTrend > 0 ? '+' : '' }}{{ kpis().coinsTrend }}% 环比
              </span>
            </div>
          </div>
        </div>

        <div class="analytics-grid">
          <!-- 播放趋势 -->
          <section class="analytics-card wide">
            <div class="card-header">
              <h3>播放趋势</h3>
              <span class="card-subtitle">{{ currentRangeLabel() }}</span>
            </div>
            <div class="trend-chart-container">
              <div class="trend-chart">
                @for (item of data.playTrend; track item.date) {
                  <div class="trend-bar-wrapper">
                    <div class="trend-bar" [style.height.%]="getTrendHeight(item.plays)"
                         [title]="item.date + ': ' + item.plays + '次播放'">
                    </div>
                  </div>
                }
              </div>
              <div class="trend-x-axis">
                @for (item of getXAxisLabels(data.playTrend); track item) {
                  <span>{{ item }}</span>
                }
              </div>
            </div>
          </section>

          <!-- 互动分布 -->
          <section class="analytics-card">
            <div class="card-header"><h3>互动分布</h3></div>
            <div class="breakdown-chart">
              @for (item of breakdownItems(data.interactionBreakdown); track item.label) {
                <div class="breakdown-item">
                  <div class="breakdown-icon" [style.background-color]="item.color + '20'">
                    <div [style.color]="item.color">{{ item.icon }}</div>
                  </div>
                  <div class="breakdown-info">
                    <div class="breakdown-top">
                      <span class="breakdown-label">{{ item.label }}</span>
                      <span class="breakdown-value">{{ formatNumber(item.value) }}</span>
                    </div>
                    <div class="breakdown-bar-bg">
                      <div class="breakdown-bar" [style.width.%]="item.percent" [style.background-color]="item.color"></div>
                    </div>
                  </div>
                </div>
              }
            </div>
          </section>

          <!-- 粉丝增长 -->
          <section class="analytics-card">
            <div class="card-header"><h3>粉丝增长</h3></div>
            <div class="follower-chart-container">
              <svg viewBox="0 0 300 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="followerGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--game-brand)" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="var(--game-brand)" stop-opacity="0"/>
                  </linearGradient>
                </defs>
                <polygon [attr.points]="followerAreaPoints(data.followerTrend)" fill="url(#followerGradient)"/>
                <polyline [attr.points]="followerPolyline(data.followerTrend)"
                          fill="none" stroke="var(--game-brand)" stroke-width="2"/>
                @for (pt of followerPoints(data.followerTrend); track pt.x) {
                  <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3" fill="var(--game-brand)"/>
                }
              </svg>
              <div class="follower-stats">
                <div class="follower-stat">
                  <span class="follower-number">{{ formatNumber(kpis().totalFollowers) }}</span>
                  <span class="follower-label">总粉丝</span>
                </div>
                <div class="follower-stat">
                  <span class="follower-number">{{ formatNumber(data.followerTrend[data.followerTrend.length - 1]?.followers || 0) }}</span>
                  <span class="follower-label">今日新增</span>
                </div>
              </div>
            </div>
          </section>

          <!-- 游戏排行 -->
          <section class="analytics-card wide">
            <div class="card-header">
              <h3>游戏排行 Top 10</h3>
              <a routerLink="/games/rankings" class="view-more">查看完整排行 →</a>
            </div>
            <div class="ranking-list">
              @for (game of data.gameRanking.slice(0, 10); track game.gameId; let i = $index) {
                <div class="ranking-item">
                  <span class="ranking-number" [class.top3]="i < 3">{{ i + 1 }}</span>
                  <span class="ranking-title">{{ game.title }}</span>
                  <div class="ranking-bar-container">
                    <div class="ranking-bar" [style.width.%]="(game.plays / maxPlays()) * 100"></div>
                  </div>
                  <div class="ranking-stats">
                    <span class="stat-plays">▶ {{ formatNumber(game.plays) }}</span>
                    <span class="stat-likes">❤ {{ formatNumber(game.likes) }}</span>
                    <span class="stat-coins">🪙 {{ formatNumber(game.coins) }}</span>
                  </div>
                </div>
              }
            </div>
          </section>
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
  styles: [`
    .analytics-dashboard { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }

    .analytics-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .analytics-header h2 { font-size: 1.5rem; margin: 0 0 0.25rem; }
    .analytics-subtitle { color: var(--game-muted); font-size: 0.85rem; margin: 0; }

    .analytics-actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }

    .time-range-selector {
      display: flex;
      background: var(--game-surface);
      border: 1px solid var(--game-border);
      border-radius: 6px;
      overflow: hidden;
    }

    .time-range-selector button {
      padding: 0.4rem 0.75rem;
      border: none;
      background: transparent;
      font-size: 0.82rem;
      color: var(--game-muted);
      cursor: pointer;
      transition: all 0.2s;
    }

    .time-range-selector button.active {
      background: var(--game-brand);
      color: #fff;
    }

    .export-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.4rem 0.85rem;
      border: 1px solid var(--game-border);
      border-radius: 6px;
      background: #fff;
      color: var(--game-text);
      font-size: 0.82rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .export-btn:hover { border-color: var(--game-brand); color: var(--game-brand); }
    .export-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .export-btn my-global-icon { height: 0.85rem; width: 0.85rem; }

    /* KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    @media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 500px) { .kpi-grid { grid-template-columns: 1fr; } }

    .kpi-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: #fff;
      border: 1px solid var(--game-border);
      border-radius: var(--game-radius);
      padding: 1rem;
    }

    .kpi-icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .kpi-icon.plays { background: #dbeafe; color: #3b82f6; }
    .kpi-icon.likes { background: #fee2e2; color: #ef4444; }
    .kpi-icon.followers { background: #dcfce7; color: #22c55e; }
    .kpi-icon.coins { background: #fef3c7; color: #f59e0b; }
    .kpi-icon my-global-icon { height: 1.1rem; width: 1.1rem; }

    .kpi-data { display: flex; flex-direction: column; min-width: 0; }
    .kpi-value { font-size: 1.25rem; font-weight: 700; color: var(--game-text); }
    .kpi-label { font-size: 0.78rem; color: var(--game-muted); }
    .kpi-trend { font-size: 0.75rem; font-weight: 600; }
    .kpi-trend.up { color: #22c55e; }
    .kpi-trend.down { color: #ef4444; }

    /* Grid */
    .analytics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }

    .analytics-card {
      background: #fff;
      border: 1px solid var(--game-border);
      border-radius: var(--game-radius);
      padding: 1rem;
    }

    .analytics-card.wide { grid-column: 1 / -1; }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .card-header h3 { font-size: 0.95rem; margin: 0; color: var(--game-text); }
    .card-subtitle { font-size: 0.78rem; color: var(--game-muted); }
    .view-more { font-size: 0.8rem; color: var(--game-brand); text-decoration: none; }
    .view-more:hover { text-decoration: underline; }

    /* Trend Chart */
    .trend-chart-container { padding: 0.5rem 0; }

    .trend-chart {
      display: flex;
      align-items: flex-end;
      gap: 0.35rem;
      height: 10rem;
      padding-bottom: 0.5rem;
    }

    .trend-bar-wrapper {
      flex: 1;
      display: flex;
      align-items: flex-end;
      min-width: 0.5rem;
      height: 100%;
    }

    .trend-bar {
      width: 100%;
      background: linear-gradient(180deg, var(--game-brand) 0%, rgb(0 0 0 / 15%) 100%);
      border-radius: 3px 3px 0 0;
      transition: height 0.5s ease;
      min-height: 2px;
    }

    .trend-bar:hover { opacity: 0.8; }

    .trend-x-axis {
      display: flex;
      justify-content: space-between;
      padding-top: 0.5rem;
      border-top: 1px solid var(--game-border);
    }

    .trend-x-axis span { font-size: 0.65rem; color: var(--game-muted); }

    /* Breakdown */
    .breakdown-chart { display: flex; flex-direction: column; gap: 0.75rem; }

    .breakdown-item { display: flex; align-items: center; gap: 0.65rem; }

    .breakdown-icon {
      width: 2rem;
      height: 2rem;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 0.9rem;
    }

    .breakdown-info { flex: 1; min-width: 0; }
    .breakdown-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; }
    .breakdown-label { font-size: 0.8rem; color: var(--game-text); }
    .breakdown-value { font-size: 0.8rem; font-weight: 700; color: var(--game-text); }

    .breakdown-bar-bg {
      height: 0.5rem;
      background: var(--game-border);
      border-radius: 999px;
      overflow: hidden;
    }

    .breakdown-bar { height: 100%; border-radius: 999px; transition: width 0.5s ease; }

    /* Follower Chart */
    .follower-chart-container { padding: 0.5rem 0; }
    .follower-chart-container svg { width: 100%; height: 120px; }

    .follower-stats {
      display: flex;
      gap: 1.5rem;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--game-border);
    }

    .follower-stat { display: flex; flex-direction: column; }
    .follower-number { font-size: 1.1rem; font-weight: 700; color: var(--game-text); }
    .follower-label { font-size: 0.78rem; color: var(--game-muted); }

    /* Ranking */
    .ranking-list { display: flex; flex-direction: column; gap: 0.35rem; }

    .ranking-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.5rem;
      border-radius: var(--game-radius);
      background: rgb(0 0 0 / 2%);
    }

    .ranking-number {
      width: 1.6rem;
      height: 1.6rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 0.75rem;
      font-weight: 700;
      background: var(--game-border);
      color: var(--game-muted);
      flex-shrink: 0;
    }

    .ranking-number.top3 { background: linear-gradient(135deg, #f59e0b, #ef4444); color: #fff; }
    .ranking-title { width: 8rem; font-size: 0.82rem; color: var(--game-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }

    .ranking-bar-container {
      flex: 1;
      height: 0.4rem;
      background: var(--game-border);
      border-radius: 999px;
      overflow: hidden;
    }

    .ranking-bar { height: 100%; background: linear-gradient(90deg, var(--game-brand), #34d399); border-radius: 999px; transition: width 0.5s ease; }

    .ranking-stats { display: flex; gap: 0.65rem; font-size: 0.7rem; color: var(--game-muted); flex-shrink: 0; width: 9rem; justify-content: flex-end; }
    .ranking-stats span { white-space: nowrap; }

    /* Loading */
    .analytics-loading { padding: 1rem; }
    .skeleton-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
    .skeleton-kpi { height: 4rem; border-radius: var(--game-radius); background: var(--game-border); }
    .skeleton-chart { height: 12rem; border-radius: var(--game-radius); background: var(--game-border); }
  `]
})
export class GameAnalyticsDashboardComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  analytics = signal<GameAnalytics | null>(null)
  currentRange = signal<TimeRange>('30d')
  exporting = signal(false)

  timeRanges = [
    { id: '7d' as TimeRange, label: '7天' },
    { id: '30d' as TimeRange, label: '30天' },
    { id: '90d' as TimeRange, label: '90天' }
  ]

  ngOnInit () {
    this.loadAnalytics()
  }

  loadAnalytics () {
    this.gamesService.getAnalytics().subscribe(data => this.analytics.set(data))
  }

  setTimeRange (range: TimeRange) {
    this.currentRange.set(range)
    this.loadAnalytics()
  }

  currentRangeLabel () {
    const labels: Record<TimeRange, string> = { '7d': '近7天', '30d': '近30天', '90d': '近90天' }
    return labels[this.currentRange()]
  }

  kpis = computed(() => {
    const data = this.analytics()
    if (!data) return { totalPlays: 0, totalLikes: 0, totalFollowers: 0, totalCoins: 0, playsTrend: 0, likesTrend: 0, followersTrend: 0, coinsTrend: 0 }

    const totalPlays = data.playTrend.reduce((sum, t) => sum + t.plays, 0)
    const totalLikes = data.interactionBreakdown.likes
    const totalFollowers = data.followerTrend[data.followerTrend.length - 1]?.followers || 0
    const totalCoins = data.interactionBreakdown.coins

    // Calculate simple trend (last period vs previous period)
    const mid = Math.floor(data.playTrend.length / 2)
    const playsTrend = data.playTrend.length > 1
      ? Math.round(((data.playTrend.slice(mid).reduce((s, t) => s + t.plays, 0) - data.playTrend.slice(0, mid).reduce((s, t) => s + t.plays, 0)) / Math.max(data.playTrend.slice(0, mid).reduce((s, t) => s + t.plays, 0), 1)) * 100)
      : 0

    return { totalPlays, totalLikes, totalFollowers, totalCoins, playsTrend, likesTrend: 0, followersTrend: 0, coinsTrend: 0 }
  })

  maxPlays = computed(() => {
    const data = this.analytics()
    if (!data) return 1
    return Math.max(...data.gameRanking.map(g => g.plays), 1)
  })

  getTrendHeight (plays: number): number {
    const data = this.analytics()
    if (!data) return 0
    const max = Math.max(...data.playTrend.map(t => t.plays), 1)
    return (plays / max) * 100
  }

  getXAxisLabels (trend: { date: string; plays: number }[]): string[] {
    if (!trend.length) return []
    const count = trend.length
    return [trend[0].date.slice(5), trend[Math.floor(count / 2)].date.slice(5), trend[count - 1].date.slice(5)]
  }

  breakdownItems (breakdown: GameAnalytics['interactionBreakdown']) {
    const max = Math.max(breakdown.likes, breakdown.coins, breakdown.favorites, breakdown.comments, breakdown.reviews, 1)
    const icons: Record<string, string> = { '点赞': '❤', '投币': '🪙', '收藏': '⭐', '评论': '💬', '评价': '✍' }
    return [
      { label: '点赞', value: breakdown.likes, percent: (breakdown.likes / max) * 100, color: '#ef4444', icon: icons['点赞'] },
      { label: '投币', value: breakdown.coins, percent: (breakdown.coins / max) * 100, color: '#f59e0b', icon: icons['投币'] },
      { label: '收藏', value: breakdown.favorites, percent: (breakdown.favorites / max) * 100, color: '#3b82f6', icon: icons['收藏'] },
      { label: '评论', value: breakdown.comments, percent: (breakdown.comments / max) * 100, color: '#22c55e', icon: icons['评论'] },
      { label: '评价', value: breakdown.reviews, percent: (breakdown.reviews / max) * 100, color: '#8b5cf6', icon: icons['评价'] }
    ]
  }

  followerPolyline (trend: { date: string; followers: number }[]): string {
    if (!trend.length) return ''
    const max = Math.max(...trend.map(t => t.followers), 1)
    const stepX = 300 / (trend.length - 1 || 1)
    return trend.map((t, i) => {
      const x = i * stepX
      const y = 120 - (t.followers / max) * 100
      return `${x},${y}`
    }).join(' ')
  }

  followerAreaPoints (trend: { date: string; followers: number }[]): string {
    if (!trend.length) return ''
    const max = Math.max(...trend.map(t => t.followers), 1)
    const stepX = 300 / (trend.length - 1 || 1)
    const points = trend.map((t, i) => {
      const x = i * stepX
      const y = 120 - (t.followers / max) * 100
      return `${x},${y}`
    }).join(' ')
    return `0,120 ${points} 300,120`
  }

  followerPoints (trend: { date: string; followers: number }[]): { x: number; y: number }[] {
    if (!trend.length) return []
    const max = Math.max(...trend.map(t => t.followers), 1)
    const stepX = 300 / (trend.length - 1 || 1)
    return trend.map((t, i) => ({
      x: i * stepX,
      y: 120 - (t.followers / max) * 100
    }))
  }

  totalFollowers (trend: { date: string; followers: number }[]): number {
    return trend.reduce((sum, t) => sum + t.followers, 0)
  }

  formatNumber (num: number): string {
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return String(num)
  }

  exportData () {
    const data = this.analytics()
    if (!data) return
    this.exporting.set(true)

    // Build CSV
    const csvRows = [
      ['日期', '播放量'],
      ...data.playTrend.map(t => [t.date, String(t.plays)])
    ]
    const csv = csvRows.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)

    setTimeout(() => this.exporting.set(false), 500)
  }
}
