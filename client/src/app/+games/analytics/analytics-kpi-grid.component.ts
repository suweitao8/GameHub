import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'

interface KpiSummary {
  totalPlays: number
  totalLikes: number
  totalFollowers: number
  totalCoins: number
  playsTrend: number
  likesTrend: number
  followersTrend: number
  coinsTrend: number
}

@Component({
  selector: 'my-analytics-kpi-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GlobalIconComponent ],
  template: `
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
  `,
  styles: [ `
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
  ` ]
})
export class AnalyticsKpiGridComponent {
  readonly kpis = input.required<KpiSummary>()

  formatNumber (num: number): string {
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return String(num)
  }
}
