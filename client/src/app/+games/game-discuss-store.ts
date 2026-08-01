import { Injectable, inject, OnDestroy, signal } from '@angular/core'
import { AuthService } from '@app/core/auth/auth.service'
import { Router } from '@angular/router'
import type { GameChatMessage } from '@peertube/peertube-models'
import { getGameActionErrorMessage } from './game-action-feedback'
import { buildGameAvatarDataUrl } from '../shared/game-avatar'
import { GameCommunityService } from './services/game-community.service'

/** 讨论群独立状态：不读取、不写入 GameCommentsStore。 */
@Injectable()
export class GameDiscussStore implements OnDestroy {
  private readonly communityService = inject(GameCommunityService)
  private readonly authService = inject(AuthService)
  private readonly router = inject(Router)

  readonly messages = signal<GameChatMessage[]>([])
  readonly loading = signal(true)
  readonly error = signal('')
  readonly draft = signal('')
  readonly feedback = signal('')
  readonly total = signal(0)

  private uuid = ''
  private refreshTimer: ReturnType<typeof setInterval> | undefined

  readonly timeline = () => this.messages()

  shouldShowTime (index: number) {
    if (index <= 0) return true
    const messages = this.messages()
    const currentTime = Date.parse(messages[index]?.createdAt || '')
    const previousTime = Date.parse(messages[index - 1]?.createdAt || '')
    if (!Number.isFinite(currentTime) || !Number.isFinite(previousTime)) return true
    return currentTime - previousTime > 10 * 60 * 1000
  }

  init (uuid: string) {
    this.stopPolling()
    this.uuid = uuid
    this.messages.set([])
    this.loading.set(true)
    this.error.set('')
    this.draft.set('')
    this.feedback.set('')
    this.total.set(0)
    this.load()
    this.startPolling()
  }

  submit () {
    if (!this.requireLogin()) return
    const text = this.draft().trim()
    if (!text || !this.uuid) return

    this.communityService.sendDiscussion(this.uuid, text).subscribe({
      next: result => {
        this.messages.update(messages => [ ...messages, result.message ])
        this.total.update(value => value + 1)
        this.draft.set('')
        this.feedback.set('')
        queueMicrotask(() => this.scrollToBottom())
      },
      error: err => this.feedback.set(getGameActionErrorMessage(err))
    })
  }

  isOwn (message: GameChatMessage) {
    const user = this.authService.getUser()
    const currentName = user?.account?.name || user?.username
    return !!currentName && message.account?.name === currentName
  }

  currentUserAvatar () {
    const user = this.authService.getUser()
    return buildGameAvatarDataUrl(user?.account?.displayName || user?.account?.name || user?.username || '我')
  }

  messageAvatar (message: GameChatMessage) {
    return buildGameAvatarDataUrl(message.account?.displayName || message.account?.name || '玩家')
  }

  ngOnDestroy () { this.stopPolling() }

  private load () {
    if (!this.uuid) return
    this.communityService.discussion(this.uuid, 0, 50).subscribe({
      next: result => {
        this.messages.set(result.data)
        this.total.set(result.total)
        this.loading.set(false)
        this.error.set('')
      },
      error: () => {
        this.messages.set([])
        this.total.set(0)
        this.loading.set(false)
        this.error.set('讨论群加载失败，请稍后重试')
      }
    })
  }

  private refresh () {
    if (!this.uuid) return
    this.communityService.discussion(this.uuid, 0, 50).subscribe({
      next: result => {
        this.messages.set(result.data)
        this.total.set(result.total)
        this.error.set('')
      }
    })
  }

  private startPolling () {
    this.refreshTimer = setInterval(() => this.refresh(), 4000)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  private stopPolling () {
    if (this.refreshTimer) clearInterval(this.refreshTimer)
    this.refreshTimer = undefined
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
  }

  private onVisibilityChange = () => {
    if (document.hidden) this.stopPolling()
    else this.startPolling()
  }

  private scrollToBottom () {
    const list = document.querySelector<HTMLElement>('.wechat-message-list')
    if (list) list.scrollTop = list.scrollHeight
  }

  private requireLogin () {
    if (this.authService.isLoggedIn()) return true
    void this.router.navigate([ '/login' ], { queryParams: { returnUrl: this.router.url } })
    return false
  }
}
