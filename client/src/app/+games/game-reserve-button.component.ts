import { ChangeDetectionStrategy, Component, effect, inject, signal, input, OnDestroy } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService } from '@app/core/auth/auth.service'
import { LoginModalService } from '@app/+login/login-modal.service'
import { CommonModule } from '@angular/common'
import { GamesService } from './games.service'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-game-reserve-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ CommonModule, GlobalIconComponent ],
  template: `
    <button type="button" class="reserve-button" [class.reserved]="reserved()" [class.error]="!!feedback()"
            (click)="toggleReserve()" [disabled]="loading()"
            [attr.aria-label]="reserved() ? '取消预约' : '预约游戏'">
      @if (loading()) {
        <span class="loading-dots">...</span>
      } @else if (feedback()) {
        <span class="reserve-feedback">{{ feedback() }}</span>
      } @else if (reserved()) {
        <span><my-global-icon iconName="tick" /> 已预约</span>
      } @else {
        <span><my-global-icon iconName="bell" /> 预约</span>
      }
    </button>
  `,
  styleUrl: './game-reserve-button.component.scss'
})
export class GameReserveButtonComponent implements OnDestroy {
  private readonly gamesService = inject(GamesService)
  private readonly authService = inject(AuthService)
  private readonly loginModalService = inject(LoginModalService)
  private readonly router = inject(Router)
  uuid = input.required<string>()
  reserved = signal(false)
  loading = signal(false)
  feedback = signal('')
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null
  private reservationGeneration = 0

  constructor () {
    effect(() => {
      const uuid = this.uuid()
      if (!uuid || !this.authService.isLoggedIn()) {
        this.loading.set(false)
        return
      }

      const generation = ++this.reservationGeneration
      this.loading.set(true)
      this.gamesService.reservationStatus(uuid).subscribe({
        next: result => {
          if (generation !== this.reservationGeneration) return
          this.reserved.set(result.reserved)
          this.loading.set(false)
        },
        error: () => {
          if (generation !== this.reservationGeneration) return
          // 状态查询失败不阻塞用户继续尝试预约，提交接口仍会返回权威结果。
          this.loading.set(false)
        }
      })
    })
  }

  ngOnDestroy () {
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer)
  }

  toggleReserve () {
    if (this.loading()) return
    if (!this.authService.isLoggedIn()) {
      this.loginModalService.open({ returnUrl: this.router.url, inPlace: true })
      return
    }
    if (this.reserved()) {
      this.cancelReserve()
    } else {
      this.reserve()
    }
  }

  reserve () {
    this.loading.set(true)
    this.feedback.set('')
    this.gamesService.reserve(this.uuid()).subscribe({
      next: () => {
        this.reserved.set(true)
        this.loading.set(false)
      },
      error: error => {
        this.loading.set(false)
        this.showFeedback(error?.error?.error || '预约失败，请稍后重试')
      }
    })
  }

  cancelReserve () {
    this.loading.set(true)
    this.feedback.set('')
    this.gamesService.cancelReserve(this.uuid()).subscribe({
      next: () => {
        this.reserved.set(false)
        this.loading.set(false)
      },
      error: error => {
        this.loading.set(false)
        this.showFeedback(error?.error?.error || '取消失败，请稍后重试')
      }
    })
  }

  private showFeedback (message: string) {
    this.feedback.set(message)
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer)
    this.feedbackTimer = setTimeout(() => this.feedback.set(''), 2500)
  }
}
