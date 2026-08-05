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
    <button class="reserve-button" [class.reserved]="reserved()"
            (click)="toggleReserve()" [disabled]="loading()">
      @if (loading()) {
        <span class="loading-dots">...</span>
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

  toggleReserve () {
    if (this.reserved()) {
      this.cancelReserve()
    } else {
      this.reserve()
    }
  }

  reserve () {
    this.loading.set(true)
    this.gamesService.reserve(this.uuid()).subscribe({
      next: () => {
        this.reserved.set(true)
        this.loading.set(false)
      },
      error: () => this.loading.set(false)
    })
  }

  cancelReserve () {
    this.loading.set(true)
    this.gamesService.cancelReserve(this.uuid()).subscribe({
      next: () => {
        this.reserved.set(false)
        this.loading.set(false)
      },
      error: () => this.loading.set(false)
    })
  }
}
