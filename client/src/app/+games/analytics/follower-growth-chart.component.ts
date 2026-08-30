import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'

interface FollowerTrendPoint {
  date: string
  followers: number
}

@Component({
  selector: 'my-follower-growth-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
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
          <polygon [attr.points]="areaPoints()" fill="url(#followerGradient)"/>
          <polyline [attr.points]="polylinePoints()"
                    fill="none" stroke="var(--game-brand)" stroke-width="2"/>
          @for (pt of points(); track pt.x) {
            <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3" fill="var(--game-brand)"/>
          }
        </svg>
        <div class="follower-stats">
          <div class="follower-stat">
            <span class="follower-number">{{ formatNumber(totalFollowers()) }}</span>
            <span class="follower-label">总粉丝</span>
          </div>
          <div class="follower-stat">
            <span class="follower-number">{{ formatNumber(todayNew()) }}</span>
            <span class="follower-label">今日新增</span>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [ `
    .analytics-card {
      background: var(--game-surface);
      border: 1px solid var(--game-border);
      border-radius: var(--game-radius);
      padding: 1rem;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .card-header h3 { font-size: var(--game-font-size-lg); margin: 0; color: var(--game-text); }

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
    .follower-label { font-size: var(--game-font-size-sm); color: var(--game-muted); }
  ` ]
})
export class FollowerGrowthChartComponent {
  readonly followerTrend = input.required<FollowerTrendPoint[]>()
  readonly totalFollowers = input.required<number>()

  private readonly trendMax = computed(() => {
    const trend = this.followerTrend()
    return Math.max(...trend.map(t => t.followers), 1)
  })

  readonly todayNew = computed(() => {
    const trend = this.followerTrend()
    return trend[trend.length - 1]?.followers || 0
  })

  readonly polylinePoints = computed(() => {
    const trend = this.followerTrend()
    if (!trend.length) return ''
    const max = this.trendMax()
    const stepX = 300 / (trend.length - 1 || 1)
    return trend.map((t, i) => {
      const x = i * stepX
      const y = 120 - (t.followers / max) * 100
      return `${x},${y}`
    }).join(' ')
  })

  readonly areaPoints = computed(() => {
    const poly = this.polylinePoints()
    if (!poly) return ''
    return `0,120 ${poly} 300,120`
  })

  readonly points = computed<{ x: number; y: number }[]>(() => {
    const trend = this.followerTrend()
    if (!trend.length) return []
    const max = this.trendMax()
    const stepX = 300 / (trend.length - 1 || 1)
    return trend.map((t, i) => ({
      x: i * stepX,
      y: 120 - (t.followers / max) * 100
    }))
  })

  formatNumber (num: number): string {
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return String(num)
  }
}
