import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'

interface PlayTrendPoint {
  date: string
  plays: number
}

@Component({
  selector: 'my-play-trend-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <section class="analytics-card wide">
      <div class="card-header">
        <h3>播放趋势</h3>
        <span class="card-subtitle">{{ rangeLabel() }}</span>
      </div>
      <div class="trend-chart-container">
        <div class="trend-chart">
          @for (item of playTrend(); track item.date) {
            <div class="trend-bar-wrapper">
              <div class="trend-bar" [style.height.%]="getTrendHeight(item.plays)"
                   [title]="item.date + ': ' + item.plays + '次播放'">
              </div>
            </div>
          }
        </div>
        <div class="trend-x-axis">
          @for (item of xAxisLabels(); track item) {
            <span>{{ item }}</span>
          }
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

    .analytics-card.wide { grid-column: 1 / -1; }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .card-header h3 { font-size: var(--game-font-size-lg); margin: 0; color: var(--game-text); }
    .card-subtitle { font-size: var(--game-font-size-sm); color: var(--game-muted); }

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
      background: var(--game-brand);
      border-radius: var(--game-radius-xs) var(--game-radius-xs) 0 0;
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

    .trend-x-axis span { font-size: var(--game-font-size-xs); color: var(--game-muted); }
  ` ]
})
export class PlayTrendChartComponent {
  readonly playTrend = input.required<PlayTrendPoint[]>()
  readonly rangeLabel = input.required<string>()

  private readonly maxPlays = computed(() => {
    const trend = this.playTrend()
    return Math.max(...trend.map(t => t.plays), 1)
  })

  readonly xAxisLabels = computed(() => {
    const trend = this.playTrend()
    if (!trend.length) return [] as string[]
    const count = trend.length
    return [
      trend[0].date.slice(5),
      trend[Math.floor(count / 2)].date.slice(5),
      trend[count - 1].date.slice(5)
    ]
  })

  getTrendHeight (plays: number): number {
    return (plays / this.maxPlays()) * 100
  }
}
