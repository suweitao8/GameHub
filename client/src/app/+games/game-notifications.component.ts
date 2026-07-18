import { DatePipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core'
import { AuthService } from '@app/core/auth/auth.service'
import { RouterLink } from '@angular/router'
import { GameNotificationBadgeService } from '../header/game-notification-badge.service'
import { getGameActionErrorMessage } from './game-action-feedback'
import { markAllGameNotificationsRead, markGameNotificationRead } from './game-notification-state'
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
  private readonly notificationBadge = inject(GameNotificationBadgeService)
  readonly notifications = signal<GameNotification[]>([])
  readonly selectedFilter = signal<NotificationFilter>('all')
  readonly unread = signal(0)
  readonly loading = signal(true)
  readonly error = signal('')
  readonly feedback = signal('')
  readonly notificationLoading = signal<number | null>(null)
  readonly markAllLoading = signal(false)
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
    this.feedback.set('')
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
        this.notificationBadge.setUnread(result.unread)
        this.loading.set(false)
      },
      error: error => {
        this.error.set(getGameActionErrorMessage(error))
        this.loading.set(false)
      }
    })
  }

  markRead (notification: GameNotification) {
    if (notification.read || this.notificationLoading() !== null || this.markAllLoading()) return
    this.notificationLoading.set(notification.id)
    this.gamesService.markNotificationRead(notification.id).subscribe({
      next: () => {
        const result = markGameNotificationRead(this.notifications(), notification.id)
        this.notifications.set(result.notifications)
        if (result.changed) {
          this.unread.update(value => Math.max(0, value - 1))
          this.notificationBadge.decrement()
        }
        this.notificationLoading.set(null)
      },
      error: error => {
        this.feedback.set(getGameActionErrorMessage(error))
        this.notificationLoading.set(null)
      }
    })
  }

  markAllRead () {
    if (!this.unread()) return
    if (this.markAllLoading()) return
    this.markAllLoading.set(true)
    this.gamesService.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.set(markAllGameNotificationsRead(this.notifications()))
        this.unread.set(0)
        this.notificationBadge.clear()
        this.markAllLoading.set(false)
      },
      error: error => {
        this.feedback.set(getGameActionErrorMessage(error))
        this.markAllLoading.set(false)
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
