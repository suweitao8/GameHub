import { Component, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterModule } from '@angular/router'
import { GamesService } from '../games.service'
import type { Game } from '../games.service'

@Component({
  selector: 'my-game-reservations',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="reservations-container">
      <div class="reservations-header">
        <h2>我的预约</h2>
        <span class="reservations-count">{{ reservations().length }} 个游戏</span>
      </div>

      <div class="reservations-list">
        @for (item of reservations(); track item.id) {
          <div class="reservation-card">
            <a class="reservation-cover" [routerLink]="['/games', item.game.uuid]">
              @if (item.game.coverPath) {
                <img [src]="item.game.coverPath" [alt]="item.game.title" loading="lazy">
              } @else {
                <div class="placeholder-cover">{{ item.game.title.charAt(0).toUpperCase() }}</div>
              }
            </a>
            <div class="reservation-info">
              <a class="reservation-title" [routerLink]="['/games', item.game.uuid]">{{ item.game.title }}</a>
              <div class="reservation-meta">
                <span class="reservation-date">预约于 {{ formatDate(item.createdAt) }}</span>
                @if (item.notified) {
                  <span class="notified-badge">已通知</span>
                }
              </div>
            </div>
            <button class="cancel-btn" (click)="cancelReservation(item.id, $index)" [disabled]="item.loading">
              {{ item.loading ? '取消中...' : '取消预约' }}
            </button>
          </div>
        } @empty {
          <div class="reservations-empty">
            <span>暂无预约</span>
            <p>浏览游戏库，预约你感兴趣的游戏</p>
            <a routerLink="/games" class="browse-link">浏览游戏</a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .reservations-container { max-width: 900px; margin: 0 auto; padding: 1rem; }

    .reservations-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--game-border);
    }

    .reservations-header h2 { font-size: 1.4rem; margin: 0; }

    .reservations-count {
      font-size: 0.8rem;
      color: var(--game-muted);
    }

    .reservations-list { display: flex; flex-direction: column; gap: 0.75rem; }

    .reservation-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: var(--game-radius);
      background: var(--game-surface);
      border: 1px solid var(--game-border);
      transition: all 0.2s;
    }

    .reservation-card:hover { border-color: var(--game-brand); }

    .reservation-cover {
      width: 5rem;
      height: 5rem;
      border-radius: 6px;
      overflow: hidden;
      flex-shrink: 0;
      display: block;
    }

    .reservation-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .placeholder-cover {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--game-brand), #34d399);
      color: #fff;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .reservation-info { flex: 1; min-width: 0; }
    .reservation-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--game-text);
      text-decoration: none;
      display: block;
      margin-bottom: 0.25rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .reservation-title:hover { color: var(--game-brand); }

    .reservation-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
    }

    .reservation-date { color: var(--game-muted); }

    .notified-badge {
      font-size: 0.7rem;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      background: #dbeafe;
      color: #3b82f6;
    }

    .cancel-btn {
      padding: 0.4rem 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--game-border);
      background: var(--game-surface);
      color: var(--game-muted);
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .cancel-btn:hover:not(:disabled) {
      background: #fee2e2;
      color: #ef4444;
      border-color: #ef4444;
    }

    .cancel-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .reservations-empty {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--game-muted);
    }

    .reservations-empty span { font-size: 1.1rem; display: block; margin-bottom: 0.5rem; }
    .reservations-empty p { font-size: 0.8rem; margin-bottom: 1rem; }

    .browse-link {
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: var(--game-radius);
      background: linear-gradient(135deg, var(--game-brand), #34d399);
      color: #fff;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
      transition: all 0.2s;
    }

    .browse-link:hover { transform: translateY(-1px); filter: brightness(1.05); }
  `]
})
export class GameReservationsComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  reservations = signal<(ReservationItem & { loading?: boolean })[]>([])

  ngOnInit () {
    this.loadReservations()
  }

  loadReservations () {
    this.gamesService.listReservations().subscribe({
      next: (result) => {
        this.reservations.set(result.data.map(item => ({ ...item, loading: false })))
      }
    })
  }

  cancelReservation (id: number, index: number) {
    this.reservations.update(items => {
      const newItems = [...items]
      newItems[index] = { ...newItems[index], loading: true }
      return newItems
    })

    this.gamesService.cancelReserve(this.reservations()[index].game.uuid).subscribe({
      next: () => {
        this.reservations.update(items => items.filter((_, i) => i !== index))
      },
      error: () => {
        this.reservations.update(items => {
          const newItems = [...items]
          newItems[index] = { ...newItems[index], loading: false }
          return newItems
        })
      }
    })
  }

  formatDate (dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('zh-CN')
  }
}

type ReservationItem = {
  id: number
  notified: boolean
  createdAt: string
  game: Game
}
