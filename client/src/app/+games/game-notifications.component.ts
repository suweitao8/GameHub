import { DatePipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core'
import { AuthService } from '@app/core/auth/auth.service'
import { RouterLink } from '@angular/router'
import { GameNotification, GamesService } from './games.service'

type NotificationFilter = 'all' | 'comment' | 'like' | 'coin' | 'favorite' | 'follow' | 'moderation'

@Component({
  templateUrl: './game-notifications.component.html',
  styleUrl: './game-notifications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink, DatePipe ]
})
export class GameNotificationsComponent implements OnInit {
  private readonly authService = inject(AuthService)
  private readonly gamesService = inject(GamesService)
  readonly notifications = signal<GameNotification[]>([])
  readonly selectedFilter = signal<NotificationFilter>('all')
  readonly unread = signal(0)
  readonly loading = signal(true)
  readonly error = signal('')
  readonly visibleNotifications = computed(() => {
    const filter = this.selectedFilter()
    return filter === 'all'
      ? this.notifications()
      : this.notifications().filter(notification => filter === 'comment'
        ? notification.kind === 'comment' || notification.kind === 'reply'
        : notification.kind === filter)
  })

  ngOnInit () {
    this.load()
  }

  load () {
    if (!this.authService.isLoggedIn()) {
      this.error.set('请先登录后查看 GameHub 消息。')
      this.loading.set(false)
      return
    }

    this.loading.set(true)
    this.gamesService.notifications().subscribe({
      next: result => {
        this.notifications.set(result.data)
        this.unread.set(result.unread)
        this.loading.set(false)
      },
      error: () => {
        this.error.set('请先登录后查看 GameHub 消息。')
        this.loading.set(false)
      }
    })
  }

  markRead (notification: GameNotification) {
    if (notification.read) return
    this.gamesService.markNotificationRead(notification.id).subscribe({
      next: () => {
        notification.read = true
        this.unread.update(value => Math.max(0, value - 1))
      }
    })
  }

  markAllRead () {
    if (!this.unread()) return
    this.gamesService.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.update(items => items.map(item => ({ ...item, read: true })))
        this.unread.set(0)
      }
    })
  }

  label (kind: GameNotification['kind']) {
    return {
      comment: '评论',
      reply: '回复',
      like: '点赞',
      coin: '投币',
      favorite: '收藏',
      follow: '关注',
      moderation: '审核',
      system: '系统'
    }[kind]
  }
}
