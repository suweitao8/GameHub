import { ChangeDetectionStrategy, Component, Input } from '@angular/core'

/**
 * 通用空状态组件
 *
 * 用法：<game-empty-state [title]="'暂无游戏'" [description]="'敬请期待'" />
 */
@Component({
  selector: 'game-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="game-empty-state">
      <span class="game-empty-icon" aria-hidden="true">{{ icon }}</span>
      <p class="game-empty-title">{{ title }}</p>
      @if (description) {
        <p class="game-empty-desc">{{ description }}</p>
      }
    </div>
  `,
  styles: [`
    .game-empty-state {
      align-items: center;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      justify-content: center;
      padding: 3rem 1rem;
      text-align: center;
    }
    .game-empty-icon {
      color: #d0d0d0;
      font-size: 3rem;
    }
    .game-empty-title {
      color: #666;
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
    }
    .game-empty-desc {
      color: #999;
      font-size: 0.85rem;
      margin: 0;
    }
  `]
})
export class GameEmptyStateComponent {
  @Input() icon = '🎮'
  @Input() title = '暂无内容'
  @Input() description = ''
}
