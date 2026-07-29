import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core'

/**
 * 通用错误重试组件
 *
 * 用法：<game-error-retry [message]="'加载失败'" (retry)="reload()" />
 */
@Component({
  selector: 'game-error-retry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="game-error-state">
      <span class="game-error-icon" aria-hidden="true">{{ icon }}</span>
      <p class="game-error-text">{{ message }}</p>
      <button type="button" class="game-error-retry-btn" (click)="retry.emit()">
        重试
      </button>
    </div>
  `,
  styles: [`
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
      color: #fb7299;
      font-size: 2.5rem;
    }
    .game-error-text {
      color: #999;
      font-size: 0.9rem;
      margin: 0;
    }
    .game-error-retry-btn {
      background: #00aeec;
      border: 0;
      border-radius: 4px;
      color: #fff;
      cursor: pointer;
      font-size: 0.85rem;
      padding: 0.5rem 1.5rem;
      transition: background 160ms ease;
    }
    .game-error-retry-btn:hover {
      background: #0090c4;
    }
  `]
})
export class GameErrorRetryComponent {
  @Input() message = '加载失败，请稍后重试'
  @Input() icon = '⚠'
  @Output() retry = new EventEmitter<void>()
}
