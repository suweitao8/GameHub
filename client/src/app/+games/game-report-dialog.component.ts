import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService } from '@app/core/auth/auth.service'
import { LoginModalService } from '@app/+login/login-modal.service'
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
  styleUrl: './game-report-dialog.component.scss',
  template: `
    @if (open()) {
      <div class="report-dialog-overlay" role="button" tabindex="-1"
           (click)="requestClose()" (keydown.escape)="requestClose()">
        <div class="report-dialog" role="dialog" tabindex="-1"
             (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
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
  private readonly loginModalService = inject(LoginModalService)
  private readonly router = inject(Router)

  readonly reportReasons = [
    '色情低俗', '暴力血腥', '违法违规', '侵权抄袭',
    '恶意代码', '无法运行', '垃圾内容', '其他'
  ]

  /** Game uuid to report against. */
  readonly uuid = input.required<string>()

  /** Two-way controlled visibility: `<my-game-report-dialog [(open)]="reportOpen" />`. */
  readonly open = input(false)

  readonly openChange = output<boolean>()
  readonly closed = output()
  readonly submitted = output()

  readonly reason = signal('')
  readonly predefined = signal<string[]>([])
  readonly submitting = signal(false)
  readonly feedback = signal('')

  constructor () {
    // 当 open 变为 true 时重置表单（替代原 setter 副作用）
    effect(() => {
      if (this.open()) {
        this.reason.set('')
        this.predefined.set([])
        this.feedback.set('')
      }
    })
  }

  requestClose () {
    this.openChange.emit(false)
    this.closed.emit()
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
      this.uuid(),
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
    this.loginModalService.open({ returnUrl: this.router.url, inPlace: true })
    return false
  }
}
