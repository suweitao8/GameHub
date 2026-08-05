import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { GlobalIconComponent, type GlobalIconName } from '../../shared/shared-icons/global-icon.component'

/**
 * 通用错误重试组件
 *
 * 用法：<my-game-error-retry [message]="'加载失败'" (retry)="reload()" />
 */
@Component({
  selector: 'my-game-error-retry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GlobalIconComponent ],
  template: `
    <div class="game-error-state">
      <span class="game-error-icon" aria-hidden="true"><my-global-icon [iconName]="icon()" /></span>
      <p class="game-error-text">{{ message() }}</p>
      <button type="button" class="game-error-retry-btn" (click)="retry.emit()">
        重试
      </button>
    </div>
  `,
  styles: [ `
    .game-error-state {
      align-items: center;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      justify-content: center;
      padding: 3rem 1rem;
      text-align: center;
    }
    .game-error-icon {
      color: var(--game-accent);
      display: inline-flex;
      height: 2.5rem;
      width: 2.5rem;
    }
    .game-error-text {
      color: var(--game-text-hint);
      font-size: 0.9rem;
      margin: 0;
    }
    .game-error-retry-btn {
      background: var(--game-brand);
      border: 0;
      border-radius: 4px;
      color: #fff;
      cursor: pointer;
      font-size: 0.85rem;
      padding: 0.5rem 1.5rem;
      transition: background 160ms ease;
    }
    .game-error-retry-btn:hover {
      background: var(--game-brand-deep);
    }
  ` ]
})
export class GameErrorRetryComponent {
  readonly message = input('加载失败，请稍后重试')
  readonly icon = input<GlobalIconName>('alert')
  readonly retry = output<void>()
}
