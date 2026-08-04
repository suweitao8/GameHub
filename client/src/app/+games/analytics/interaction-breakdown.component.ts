import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { GlobalIconComponent, type GlobalIconName } from '../../shared/shared-icons/global-icon.component'

interface InteractionBreakdown {
  likes: number
  coins: number
  favorites: number
  comments: number
}

interface BreakdownItem {
  label: string
  value: number
  percent: number
  color: string
  iconName: GlobalIconName
}

@Component({
  selector: 'my-interaction-breakdown',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GlobalIconComponent ],
  template: `
    <section class="analytics-card">
      <div class="card-header"><h3>互动分布</h3></div>
      <div class="breakdown-chart">
        @for (item of breakdownItems(); track item.label) {
          <div class="breakdown-item">
            <div class="breakdown-icon" [style.background-color]="item.color + '20'">
              <div [style.color]="item.color"><my-global-icon [iconName]="item.iconName" /></div>
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
  `,
  styles: [ `
    .analytics-card {
      background: #fff;
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

    .card-header h3 { font-size: 0.95rem; margin: 0; color: var(--game-text); }

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

    .breakdown-icon > div {
      align-items: center;
      display: inline-flex;
      height: 1rem;
      justify-content: center;
      width: 1rem;
    }

    .breakdown-icon my-global-icon {
      height: 1rem;
      width: 1rem;
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
  ` ]
})
export class InteractionBreakdownComponent {
  readonly interactionBreakdown = input.required<InteractionBreakdown>()

  readonly breakdownItems = computed<BreakdownItem[]>(() => {
    const breakdown = this.interactionBreakdown()
    const max = Math.max(breakdown.likes, breakdown.coins, breakdown.favorites, breakdown.comments, 1)
    const icons: Record<string, GlobalIconName> = { 点赞: 'like', 投币: 'coin', 收藏: 'star', 评论: 'message-circle' }
    return [
      { label: '点赞', value: breakdown.likes, percent: (breakdown.likes / max) * 100, color: '#ef4444', iconName: icons['点赞'] },
      { label: '投币', value: breakdown.coins, percent: (breakdown.coins / max) * 100, color: '#f59e0b', iconName: icons['投币'] },
      { label: '收藏', value: breakdown.favorites, percent: (breakdown.favorites / max) * 100, color: '#3b82f6', iconName: icons['收藏'] },
      { label: '评论', value: breakdown.comments, percent: (breakdown.comments / max) * 100, color: '#22c55e', iconName: icons['评论'] }
    ]
  })

  formatNumber (num: number): string {
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return String(num)
  }
}
