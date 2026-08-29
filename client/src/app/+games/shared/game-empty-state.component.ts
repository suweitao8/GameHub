import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { GlobalIconComponent, type GlobalIconName } from '../../shared/shared-icons/global-icon.component'

/**
 * 通用空状态组件
 *
 * 用法：<my-game-empty-state [title]="'暂无游戏'" [description]="'敬请期待'" />
 */
@Component({
  selector: 'my-game-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GlobalIconComponent ],
  template: `
    <div class="game-empty-state">
      <span class="game-empty-icon" aria-hidden="true"><my-global-icon [iconName]="icon()" /></span>
      <p class="game-empty-title">{{ title() }}</p>
      @if (description()) {
        <p class="game-empty-desc">{{ description() }}</p>
      }
    </div>
  `,
  styles: [ `
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
      color: var(--game-border-strong);
      display: inline-flex;
      height: 3rem;
      width: 3rem;
    }
    .game-empty-title {
      color: var(--game-muted);
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
    }
    .game-empty-desc {
      color: var(--game-text-hint);
      font-size: 0.85rem;
      margin: 0;
    }
  ` ]
})
export class GameEmptyStateComponent {
  readonly icon = input<GlobalIconName>('gamepad')
  readonly title = input('暂无内容')
  readonly description = input('')
}
