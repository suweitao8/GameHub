import { Component, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import type { GameAnalytics, GameRanking } from '../games.service'
import { GamesService } from '../games.service'

@Component({
  selector: 'my-game-analytics-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (analytics(); as data) {
      <div class="analytics-dashboard">
        <h2>创作者数据中心</h2>

        <div class="analytics-grid">
          <!-- 播放趋势 -->
          <section class="analytics-card">
            <h3>近30天播放趋势</h3>
            <div class="trend-chart">
              @for (item of data.playTrend; track item.date) {
                <div class="trend-bar" [style.height.%]="getTrendHeight(item.plays)"
                     [title]="item.date + ': ' + item.plays + '次播放'">
                  <span class="trend-value">{{ item.plays }}</span>
                </div>
              }
            </div>
            <div class="trend-labels">
              @for (item of data.playTrend.slice(0, 7); track item.date; let i = $index) {
                @if (i === 0 || i === data.playTrend.length - 1 || i % 5 === 0) {
                  <span>{{ item.date.slice(5) }}</span>
                }
              }
            </div>
          </section>

          <!-- 互动分布 -->
          <section class="analytics-card">
            <h3>互动分布</h3>
            <div class="breakdown-chart">
              <div class="breakdown-item" *ngFor="let item of breakdownItems(data.interactionBreakdown)">
                <span class="breakdown-label">{{ item.label }}</span>
                <div class="breakdown-bar-bg">
                  <div class="breakdown-bar" [style.width.%]="item.percent"
                       [style.background-color]="item.color"></div>
                </div>
                <span class="breakdown-value">{{ item.value }}</span>
              </div>
            </div>
          </section>

          <!-- 游戏排行 -->
          <section class="analytics-card wide">
            <h3>游戏排行 Top 10</h3>
            <div class="ranking-list">
              @for (game of data.gameRanking.slice(0, 10); track game.gameId; let i = $index) {
                <div class="ranking-item">
                  <span class="ranking-number" [class.top3]="i < 3">{{ i + 1 }}</span>
                  <span class="ranking-title">{{ game.title }}</span>
                  <div class="ranking-stats">
                    <span>▶ {{ game.plays }}</span>
                    <span>❤ {{ game.likes }}</span>
                    <span>🪙 {{ game.coins }}</span>
                  </div>
                </div>
              }
            </div>
          </section>

          <!-- 粉丝增长 -->
          <section class="analytics-card">
            <h3>粉丝增长</h3>
            <div class="follower-chart">
              <svg viewBox="0 0 300 120" preserveAspectRatio="none">
                <polyline [attr.points]="followerPolyline(data.followerTrend)"
                          fill="none" stroke="var(--game-brand)" stroke-width="2"/>
                <circle *ngFor="let pt of followerPoints(data.followerTrend); let last = $last"
                        [attr.cx]="pt.x" [attr.cy]="pt.y" r="3"
                        [attr.fill]="last ? 'var(--game-brand)' : 'transparent'"/>
              </svg>
              <div class="follower-total">总粉丝: {{ totalFollowers(data.followerTrend) }}</div>
            </div>
          </section>
        </div>
      </div>
    }
  `,
  styles: [`
    .analytics-dashboard { padding: 1rem; }
    .analytics-dashboard h2 { font-size: 1.4rem; margin-bottom: 1rem; color: var(--game-text); }

    .analytics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1rem;
    }

    .analytics-card {
      background: var(--game-surface);
      border: 1px solid var(--game-border);
      border-radius: var(--game-radius);
      padding: 1rem;
    }

    .analytics-card.wide { grid-column: 1 / -1; }
    .analytics-card h3 { font-size: 1rem; margin-bottom: 0.75rem; color: var(--game-muted); }

    .trend-chart {
      display: flex;
      align-items: flex-end;
      gap: 0.25rem;
      height: 8rem;
      padding-bottom: 1.5rem;
      position: relative;
    }

    .trend-bar {
      flex: 1;
      min-width: 0.5rem;
      background: linear-gradient(180deg, var(--game-brand) 0%, rgb(0 0 0 / 20%) 100%);
      border-radius: 2px 2px 0 0;
      position: relative;
      transition: height 0.5s ease;
    }

    .trend-bar:hover { opacity: 0.8; }

    .trend-value {
      position: absolute;
      bottom: -1.4rem;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.6rem;
      color: var(--game-muted);
      white-space: nowrap;
    }

    .breakdown-chart { display: flex; flex-direction: column; gap: 0.6rem; }

    .breakdown-item { display: flex; align-items: center; gap: 0.5rem; }

    .breakdown-label { font-size: 0.8rem; width: 3rem; color: var(--game-text); flex-shrink: 0; }

    .breakdown-bar-bg {
      flex: 1;
      height: 0.6rem;
      background: var(--game-border);
      border-radius: 999px;
      overflow: hidden;
    }

    .breakdown-bar { height: 100%; border-radius: 999px; transition: width 0.5s ease; }
    .breakdown-value { font-size: 0.8rem; width: 2rem; text-align: right; color: var(--game-muted); }

    .ranking-list { display: flex; flex-direction: column; gap: 0.4rem; }

    .ranking-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.6rem;
      border-radius: var(--game-radius);
      background: rgb(0 0 0 / 3%);
    }

    .ranking-number {
      width: 1.5rem;
      height: 1.5rem;
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

    .ranking-number.top3 { background: var(--game-brand); color: #fff; }
    .ranking-title { flex: 1; font-size: 0.85rem; color: var(--game-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ranking-stats { display: flex; gap: 0.5rem; font-size: 0.7rem; color: var(--game-muted); }

    .follower-chart { position: relative; }
    .follower-chart svg { width: 100%; height: 120px; }
    .follower-total { text-align: center; font-size: 0.85rem; color: var(--game-muted); margin-top: 0.5rem; }
  `]
})
export class GameAnalyticsDashboardComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  analytics = signal<GameAnalytics | null>(null)

  ngOnInit () {
    this.gamesService.getAnalytics().subscribe(data => this.analytics.set(data))
  }

  getTrendHeight (plays: number): number {
    const data = this.analytics()
    if (!data) return 0
    const max = Math.max(...data.playTrend.map(t => t.plays), 1)
    return (plays / max) * 100
  }

  breakdownItems (breakdown: GameAnalytics['interactionBreakdown']) {
    const max = Math.max(breakdown.likes, breakdown.coins, breakdown.favorites, breakdown.comments, breakdown.reviews, 1)
    return [
      { label: '点赞', value: breakdown.likes, percent: (breakdown.likes / max) * 100, color: '#ef4444' },
      { label: '投币', value: breakdown.coins, percent: (breakdown.coins / max) * 100, color: '#f59e0b' },
      { label: '收藏', value: breakdown.favorites, percent: (breakdown.favorites / max) * 100, color: '#3b82f6' },
      { label: '评论', value: breakdown.comments, percent: (breakdown.comments / max) * 100, color: '#22c55e' },
      { label: '评价', value: breakdown.reviews, percent: (breakdown.reviews / max) * 100, color: '#8b5cf6' }
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
}
