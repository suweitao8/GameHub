import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output, signal } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService } from '@app/core/auth/auth.service'
import { GamesService } from './games.service'
import { getGameActionErrorMessage } from './game-action-feedback'

/**
 * Report-game dialog. Owns its form state and calls GamesService.report.
 *
 * Visibility is two-way controlled via `open` / `openChange`. The host should
 * also guard opening behind `requireLogin` before setting `open` to true.
 */
@Component({
  selector: 'my-game-report-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    /* Report dialog */
    .report-dialog-overlay {
      align-items: center;
      background: rgb(0 0 0 / 50%);
      display: flex;
      inset: 0;
      justify-content: center;
      position: fixed;
      z-index: 100;
    }

    .report-dialog {
      background: #fff;
      border-radius: var(--game-radius);
      max-width: 480px;
      overflow: hidden;
      width: calc(100% - 2rem);
    }

    .report-dialog-header {
      align-items: center;
      border-bottom: 1px solid var(--game-border);
      display: flex;
      justify-content: space-between;
      padding: 0.85rem 1rem;
    }

    .report-dialog-header h3 { font-size: 1rem; margin: 0; }

    .report-close-btn {
      background: none;
      border: none;
      color: var(--game-muted);
      cursor: pointer;
      font-size: 1.4rem;
      line-height: 1;
      padding: 0;
      width: 1.5rem;
    }

    .report-close-btn:hover { color: var(--game-text); }

    .report-dialog-body {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }

    .report-predefined p {
      color: var(--game-muted);
      font-size: 0.8rem;
      margin: 0 0 0.5rem;
    }

    .report-reasons-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .report-reasons-grid button {
      background: #f6f7f8;
      border: 1px solid var(--game-border);
      border-radius: 6px;
      color: var(--game-text);
      cursor: pointer;
      font-size: 0.78rem;
      padding: 0.35rem 0.65rem;
      transition: all 160ms ease;
    }

    .report-reasons-grid button:hover {
      background: #f0f2f4;
    }

    .report-reasons-grid button.selected {
      background: var(--game-danger);
      border-color: var(--game-danger);
      color: #fff;
    }

    .report-text-label {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.8rem;
      color: var(--game-muted);
    }

    .report-text-label textarea {
      border: 1px solid var(--game-border);
      border-radius: 6px;
      font-size: 0.85rem;
      padding: 0.5rem 0.65rem;
      resize: vertical;
    }

    .report-feedback {
      color: var(--game-success);
      font-size: 0.82rem;
      margin: 0;
    }

    .report-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }

    .report-actions button {
      border: 1px solid var(--game-border);
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.82rem;
      padding: 0.45rem 0.85rem;
    }

    .report-actions button.primary {
      background: var(--game-danger);
      border-color: var(--game-danger);
      color: #fff;
      font-weight: 600;
    }

    .report-actions button.primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    @media (max-width: 600px) {
      .report-dialog { max-width: calc(100% - 1rem); }
      .report-reasons-grid button { font-size: 0.72rem; padding: 0.3rem 0.5rem; }
    }
  `],
  template: `
    @if (isOpen()) {
      <div class="report-dialog-overlay" (click)="requestClose()">
        <div class="report-dialog" (click)="$event.stopPropagation()">
          <div class="report-dialog-header">
            <h3>举报游戏</h3>
            <button type="button" class="report-close-btn" (click)="requestClose()">&times;</button>
          </div>
          <div class="report-dialog-body">
            <div class="report-predefined">
              <p>选择举报原因（可多选）</p>
              <div class="report-reasons-grid">
                @for (reason of reportReasons; track reason) {
                  <button type="button"
                          [class.selected]="predefined().includes(reason)"
                          (click)="togglePredefined(reason)">{{ reason }}</button>
                }
              </div>
            </div>
            <label class="report-text-label">
              补充说明
              <textarea [value]="reason()" (input)="reason.set($any($event.target).value)"
                        rows="3" placeholder="详细描述问题..." maxlength="1000"></textarea>
            </label>
            @if (feedback()) { <p class="report-feedback" role="status">{{ feedback() }}</p> }
            <div class="report-actions">
              <button type="button" (click)="requestClose()">取消</button>
              <button type="button" class="primary" [disabled]="submitting()" (click)="submit()">
                {{ submitting() ? '提交中...' : '提交举报' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class GameReportDialogComponent {
  private readonly gamesService = inject(GamesService)
  private readonly authService = inject(AuthService)
  private readonly router = inject(Router)

  readonly reportReasons = [
    '色情低俗', '暴力血腥', '违法违规', '侵权抄袭',
    '恶意代码', '无法运行', '垃圾内容', '其他'
  ]

  /** Game uuid to report against. */
  @Input({ required: true }) uuid = ''

  /** Two-way controlled visibility: `<my-game-report-dialog [(open)]="reportOpen" />`. */
  @Input() set open (value: boolean) {
    this.isOpen.set(value)
    if (value) {
      this.reason.set('')
      this.predefined.set([])
      this.feedback.set('')
    }
  }
  readonly isOpen = signal(false)

  @Output() openChange = new EventEmitter<boolean>()
  @Output() close = new EventEmitter<void>()
  @Output() submitted = new EventEmitter<void>()

  readonly reason = signal('')
  readonly predefined = signal<string[]>([])
  readonly submitting = signal(false)
  readonly feedback = signal('')

  requestClose () {
    this.openChange.emit(false)
    this.close.emit()
  }

  togglePredefined (item: string) {
    this.predefined.update(list =>
      list.includes(item) ? list.filter(r => r !== item) : [ ...list, item ]
    )
  }

  submit () {
    if (!this.requireLogin()) return
    const text = this.reason().trim()
    if (!text && this.predefined().length === 0) {
      this.feedback.set('请选择或填写举报原因')
      return
    }
    this.submitting.set(true)
    this.gamesService.report(
      this.uuid,
      text || this.predefined().join(', '),
      this.predefined()
    ).subscribe({
      next: () => {
        this.submitting.set(false)
        this.feedback.set('举报已提交，我们会尽快处理')
        this.submitted.emit()
        setTimeout(() => this.requestClose(), 2000)
      },
      error: error => {
        this.submitting.set(false)
        this.feedback.set(getGameActionErrorMessage(error))
      }
    })
  }

  private requireLogin () {
    if (this.authService.isLoggedIn()) return true
    void this.router.navigate([ '/login' ], { queryParams: { returnUrl: this.router.url } })
    return false
  }
}
