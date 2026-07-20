import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-game-error-boundary',
  standalone: true,
  imports: [ GlobalIconComponent ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hasError()) {
      <div class="game-error-boundary" role="alert">
        <div class="error-boundary-content">
          <my-global-icon iconName="alert-circle" />
          <h2>页面遇到了问题</h2>
          <p>{{ errorMessage() || '发生了意外错误，请尝试刷新页面。' }}</p>
          <div class="error-boundary-actions">
            <button type="button" class="retry-btn" (click)="reset()">重新加载</button>
            <button type="button" class="refresh-btn" (click)="hardReload()">强制刷新</button>
          </div>
          @if (errorDetail()) {
            <details class="error-detail">
              <summary>查看错误详情</summary>
              <pre>{{ errorDetail() }}</pre>
            </details>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .game-error-boundary {
      align-items: center;
      background: #fff;
      border: 1px solid var(--game-border);
      border-radius: var(--game-radius);
      display: flex;
      justify-content: center;
      margin: 2rem auto;
      max-width: 520px;
      min-height: 300px;
      padding: 2rem;
    }

    .error-boundary-content {
      text-align: center;
      max-width: 400px;
    }

    .error-boundary-content my-global-icon {
      color: var(--game-danger);
      height: 2.5rem;
      margin-bottom: 1rem;
      width: 2.5rem;
    }

    .error-boundary-content h2 { font-size: 1.2rem; margin: 0 0 0.5rem; }
    .error-boundary-content p { color: var(--game-muted); font-size: 0.88rem; margin: 0 0 1.5rem; }

    .error-boundary-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
    }

    .retry-btn, .refresh-btn {
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.55rem 1rem;
      transition: background-color 160ms ease;
    }

    .retry-btn {
      background: var(--game-brand);
      border: 1px solid var(--game-brand);
      color: #fff;
    }

    .retry-btn:hover { background: var(--game-brand-deep); }

    .refresh-btn {
      background: #fff;
      border: 1px solid var(--game-border);
      color: var(--game-text);
    }

    .refresh-btn:hover { background: #f1f2f3; }

    .error-detail {
      margin-top: 1.5rem;
      text-align: left;
    }

    .error-detail summary {
      color: var(--game-muted);
      cursor: pointer;
      font-size: 0.78rem;
    }

    .error-detail pre {
      background: #f7f8f9;
      border: 1px solid var(--game-border);
      border-radius: 4px;
      color: var(--game-danger);
      font-size: 0.72rem;
      margin-top: 0.5rem;
      max-height: 200px;
      overflow: auto;
      padding: 0.75rem;
    }
  `]
})
export class GameErrorBoundaryComponent {
  readonly hasError = signal(false)
  readonly errorMessage = signal('')
  readonly errorDetail = signal('')

  handleError (error: Error) {
    this.hasError.set(true)
    this.errorMessage.set(error.message || '页面运行时发生错误')
    this.errorDetail.set(error.stack || '')
    console.error('[GameErrorBoundary]', error)
  }

  reset () {
    this.hasError.set(false)
    this.errorMessage.set('')
    this.errorDetail.set('')
    window.location.reload()
  }

  hardReload () {
    window.location.href = window.location.href
  }
}