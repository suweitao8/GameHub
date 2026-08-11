import { ChangeDetectionStrategy, Component, inject, signal, input } from '@angular/core'
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
export class GameReserveButtonComponent {
  private readonly gamesService = inject(GamesService)
  uuid = input.required<string>()
  reserved = signal(false)
  loading = signal(false)
  feedback = signal('')
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null

  toggleReserve () {
    if (this.loading()) return
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
      error: () => {
        this.loading.set(false)
        this.showFeedback('预约失败，请稍后重试')
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
      error: () => {
        this.loading.set(false)
        this.showFeedback('取消失败，请稍后重试')
      }
    })
  }

  private showFeedback (message: string) {
    this.feedback.set(message)
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer)
    this.feedbackTimer = setTimeout(() => this.feedback.set(''), 2500)
  }
}
