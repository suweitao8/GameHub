import { Component, inject, signal, input } from '@angular/core'
import { CommonModule } from '@angular/common'
import { GamesService } from './games.service'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-game-reserve-button',
  standalone: true,
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
  styles: [ `
    .reserve-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      padding: 0.5rem 1rem;
      border-radius: var(--game-radius);
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--game-border);
      background: var(--game-surface);
      color: var(--game-text);
      transition: all 0.2s ease;
    }

    .reserve-button > span {
      align-items: center;
      display: inline-flex;
      gap: 0.3rem;
    }

    .reserve-button my-global-icon {
      height: 1rem;
      width: 1rem;
    }

    .reserve-button:hover:not(:disabled) {
      background: var(--game-border);
      transform: translateY(-1px);
    }

    .reserve-button.reserved {
      background: linear-gradient(135deg, var(--game-brand) 0%, #34d399 100%);
      color: #fff;
      border-color: transparent;
    }

    .reserve-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .loading-dots { animation: dots 1.5s infinite; }

    @keyframes dots {
      0%, 20% { content: '.'; }
      40% { content: '..'; }
      60%, 100% { content: '...'; }
    }
  ` ]
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
