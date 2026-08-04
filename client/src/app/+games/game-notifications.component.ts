import { DatePipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core'
import { AuthService } from '@app/core/auth/auth.service'
import { RouterLink } from '@angular/router'
import { GameNotificationBadgeService } from '../header/game-notification-badge.service'
import { getGameActionErrorMessage } from './game-action-feedback'
import { markAllGameNotificationsRead, markGameNotificationRead, removeGameNotification } from './game-notification-state'
import { createAsyncState } from './shared'
import { GameNotification, GamesService } from './games.service'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

type NotificationFilter = 'all' | 'comment' | 'like' | 'coin' | 'favorite' | 'follow' | 'moderation'

@Component({
  templateUrl: './game-notifications.component.html',
  styleUrl: './game-notifications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink, DatePipe, GlobalIconComponent ]
})
export class GameNotificationsComponent implements OnInit {
  private readonly authService = inject(AuthService)
  private readonly gamesService = inject(GamesService)
  private readonly notificationBadge = inject(GameNotificationBadgeService)
  private readonly state = createAsyncState<{ notifications: GameNotification[]; unread: number }>()
  /** 列表数据（兼容模板 notifications()） */
  readonly notifications = computed(() => this.state.data()?.notifications ?? [])
  readonly selectedFilter = signal<NotificationFilter>('all')
  readonly unread = signal(0)
  /** 模板兼容：loading 初始为 true */
  readonly loading = this.state.loading
  readonly error = this.state.error
  readonly feedback = signal('')
  readonly notificationLoading = signal<number | null>(null)
  readonly markAllLoading = signal(false)
  readonly deletingId = signal<number | null>(null)
  readonly visibleNotifications = computed(() => {
    const filter = this.selectedFilter()
    return filter === 'all'
      ? this.notifications()
      : this.notifications().filter(notification => filter === 'comment'
        ? notification.kind === 'comment' || notification.kind === 'reply'
        : notification.kind === filter)
  })

  constructor () {
    // 对齐原 signal(true)
    this.state.loading.set(true)
  }

  ngOnInit () {
    this.load()
  }

  load () {
    this.feedback.set('')
    if (!this.authService.isLoggedIn()) {
      this.state.error.set('请先登录后查看 GameHub 消息。')
      this.state.loading.set(false)
      return
    }

    this.state.loading.set(true)
    this.state.error.set('')
    this.gamesService.notifications().subscribe({
      next: result => {
        this.state.data.set({ notifications: result.data, unread: result.unread })
        this.unread.set(result.unread)
        this.notificationBadge.setUnread(result.unread)
        this.state.loading.set(false)
      },
      error: error => {
        this.state.error.set(getGameActionErrorMessage(error))
        this.state.loading.set(false)
      }
    })
  }

  markRead (notification: GameNotification) {
    if (notification.read || this.notificationLoading() !== null || this.markAllLoading()) return
    this.notificationLoading.set(notification.id)
    this.gamesService.markNotificationRead(notification.id).subscribe({
      next: () => {
        const result = markGameNotificationRead(this.notifications(), notification.id)
        this.state.data.update(value => value ? { ...value, notifications: result.notifications } : value)
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
        this.state.data.update(value => value ? { ...value, notifications: markAllGameNotificationsRead(value.notifications) } : value)
        this.unread.set(0)
        this.notificationBadge.clear()
        this.markAllLoading.set(false)
        this.feedback.set('已将全部消息标为已读')
        setTimeout(() => this.feedback.set(''), 2000)
      },
      error: error => {
        this.feedback.set(getGameActionErrorMessage(error))
        this.markAllLoading.set(false)
      }
    })
  }

  deleteNotification (notification: GameNotification, event: Event) {
    event.stopPropagation()
    if (this.deletingId() !== null) return
    this.deletingId.set(notification.id)
    this.gamesService.deleteNotification(notification.id).subscribe({
      next: () => {
        const wasUnread = !notification.read
        this.state.data.update(value => value ? { ...value, notifications: removeGameNotification(value.notifications, notification.id) } : value)
        if (wasUnread) {
          this.unread.update(value => Math.max(0, value - 1))
          this.notificationBadge.decrement()
        }
        this.deletingId.set(null)
      },
      error: error => {
        this.feedback.set(getGameActionErrorMessage(error))
        this.deletingId.set(null)
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
