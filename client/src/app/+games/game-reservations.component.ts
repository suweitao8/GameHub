import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink } from '@angular/router'
import { GamesService } from './games.service'
import type { Game } from './games.service'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-game-reservations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ CommonModule, RouterLink, GlobalIconComponent ],
  template: `
    <div class="reservations-container">
      <div class="reservations-header">
        <h2>我的预约</h2>
        <span class="reservations-count">{{ reservations().length }} 个游戏</span>
      </div>

      @if (loading()) {
        <div class="reservations-loading" role="status">
          <my-global-icon iconName="loader" />
          <span>加载中...</span>
        </div>
      } @else if (error() && reservations().length === 0) {
        <div class="reservations-error">
          <span>加载失败</span>
          <p>{{ error() }}</p>
          <button type="button" (click)="loadReservations()">重新加载</button>
        </div>
      } @else {
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
                    <span class="notified-badge">已发布</span>
                  } @else {
                    <span class="pending-badge">等待发布</span>
                  }
                </div>
                <div class="reservation-stats">
                  <span><my-global-icon iconName="play" />{{ item.game.playCount }} 游玩</span>
                  <span><my-global-icon iconName="message-circle" />{{ item.game.comments || 0 }} 评论</span>
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
      }
    </div>
  `,
  styleUrl: './game-reservations.component.scss'
})
export class GameReservationsComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  reservations = signal<(ReservationItem & { loading?: boolean })[]>([])
  loading = signal(false)
  error = signal('')

  ngOnInit () {
    this.loadReservations()
  }

  loadReservations () {
    this.loading.set(true)
    this.error.set('')
    this.gamesService.listReservations().subscribe({
      next: (result) => {
        this.reservations.set(result.data.map(item => ({ ...item, loading: false })))
        this.loading.set(false)
      },
      error: () => {
        this.loading.set(false)
        this.error.set('预约列表加载失败，请稍后重试')
      }
    })
  }

  cancelReservation (id: number, index: number) {
    this.reservations.update(items => {
      const newItems = [ ...items ]
      newItems[index] = { ...newItems[index], loading: true }
      return newItems
    })

    this.gamesService.cancelReserve(this.reservations()[index].game.uuid).subscribe({
      next: () => {
        this.reservations.update(items => items.filter((_, i) => i !== index))
      },
      error: () => {
        this.reservations.update(items => {
          const newItems = [ ...items ]
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
