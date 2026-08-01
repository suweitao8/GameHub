import { Injectable, inject, OnDestroy, signal } from '@angular/core'
import { AuthService } from '@app/core/auth/auth.service'
import { Router } from '@angular/router'
import { GamesService, GameComment } from './games.service'
import { getGameActionErrorMessage } from './game-action-feedback'
import { buildGameAvatarDataUrl } from '../shared/game-avatar'

/**
 * Shared comment state for a single game's comment + discuss panels.
 *
 * Provided at the `GameCommentsComponent` host so the comment list (main
 * column) and the discuss sidebar (side column) read from the same store.
 * The host component sets `uuid` on init; polling and visibility handling
 * live here so both views stay in sync.
 */
@Injectable()
export class GameCommentsStore implements OnDestroy {
  private readonly gamesService = inject(GamesService)
  private readonly authService = inject(AuthService)
  private readonly router = inject(Router)

  readonly comments = signal<GameComment[]>([])
  readonly loading = signal(true)
  readonly error = signal('')
  readonly total = signal(0)
  readonly loadingMore = signal(false)
  readonly draft = signal('')
  readonly commentImage = signal<File | null>(null)
  readonly chatDraft = signal('')
  readonly sort = signal<'new' | 'hot'>('hot')
  readonly replyTo = signal<number | null>(null)
  readonly replies = signal<Record<number, GameComment[]>>({})
  readonly feedback = signal('')
  readonly deleteTarget = signal<GameComment | null>(null)

  private uuid = ''
  private refreshTimer: ReturnType<typeof setInterval> | undefined

  /** Sorted hottest-first or latest-first for the comment list. */
  readonly sorted = () => {
    const list = [ ...this.comments() ]
    if (this.sort() === 'hot') {
      return list.sort((a, b) => (b.likes || 0) - (a.likes || 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  /** Chronological timeline for the discuss sidebar. */
  readonly timeline = () => {
    return [ ...this.comments() ].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }

  init (uuid: string) {
    this.uuid = uuid
    this.reset()
    this.load(uuid, this.sort())
    this.startPolling()
  }

  setUuid (uuid: string) { this.uuid = uuid }

  private reset () {
    this.comments.set([])
    this.loading.set(true)
    this.error.set('')
    this.draft.set('')
    this.commentImage.set(null)
    this.chatDraft.set('')
    this.sort.set('hot')
    this.replyTo.set(null)
    this.replies.set({})
    this.feedback.set('')
    this.deleteTarget.set(null)
  }

  setSort (value: 'new' | 'hot') {
    if (this.sort() === value) return
    this.sort.set(value)
    this.loading.set(true)
    this.load(this.uuid, value)
  }

  loadMore () {
    if (this.loadingMore() || this.comments().length >= this.total()) return
    this.loadingMore.set(true)
    this.gamesService.comments(this.uuid, this.sort(), this.comments().length, 20).subscribe({
      next: result => {
        this.comments.update(prev => [ ...prev, ...result.data ])
        this.total.set(result.total)
        this.loadingMore.set(false)
      },
      error: () => this.loadingMore.set(false)
    })
  }

  hasMore () {
    return this.comments().length < this.total()
  }

  submit (image = this.commentImage()) {
    if (!this.requireLogin()) return
    const text = this.draft().trim()
    if (!text) return
    this.gamesService.comment(this.uuid, text, image).subscribe({
      next: result => {
        this.comments.update(comments => [ result.comment, ...comments ])
        this.total.update(value => value + 1)
        this.draft.set('')
        this.commentImage.set(null)
        this.feedback.set('')
      },
      error: err => this.feedback.set(getGameActionErrorMessage(err))
    })
  }

  submitChat () {
    if (!this.requireLogin()) return
    const text = this.chatDraft().trim()
    if (!text) return
    this.gamesService.comment(this.uuid, text).subscribe({
      next: result => {
        this.comments.update(comments => [ ...comments, result.comment ])
        this.total.update(value => value + 1)
        this.chatDraft.set('')
        queueMicrotask(() => this.scrollDiscussToBottom())
      },
      error: err => this.feedback.set(getGameActionErrorMessage(err))
    })
  }

  submitReply (image = this.commentImage()) {
    if (!this.requireLogin()) return
    const parentId = this.replyTo()
    const text = this.draft().trim()
    if (!parentId || !text) return
    this.gamesService.reply(this.uuid, parentId, text, image).subscribe({
      next: result => {
        this.comments.update(comments => comments.map(comment => comment.id === parentId
          ? { ...comment, totalReplies: (comment.totalReplies || 0) + 1 }
          : comment))
        this.draft.set('')
        this.commentImage.set(null)
        this.replyTo.set(null)
        this.replies.update(replies => ({
          ...replies,
          [parentId]: [ ...(replies[parentId] || []), result.comment ]
        }))
      },
      error: err => this.feedback.set(getGameActionErrorMessage(err))
    })
  }

  toggleLike (comment: GameComment) {
    if (!this.requireLogin()) return
    this.gamesService.likeComment(this.uuid, comment.id, !comment.liked).subscribe({
      next: value => this.updateComment(comment.id, { liked: value.liked, likes: value.likes }),
      error: err => this.feedback.set(getGameActionErrorMessage(err))
    })
  }

  toggleReplies (comment: GameComment) {
    if (this.replies()[comment.id]) {
      this.replies.update(replies => {
        const next = { ...replies }
        delete next[comment.id]
        return next
      })
      return
    }

    this.gamesService.replies(this.uuid, comment.id).subscribe({
      next: result => this.replies.update(replies => ({ ...replies, [comment.id]: result.data })),
      error: err => this.feedback.set(getGameActionErrorMessage(err))
    })
  }

  requestDelete (comment: GameComment) {
    if (comment.canDelete) this.deleteTarget.set(comment)
  }

  confirmDelete () {
    if (!this.requireLogin()) return
    const comment = this.deleteTarget()
    if (!comment) return
    this.gamesService.deleteComment(this.uuid, comment.id).subscribe({
      next: () => {
        this.comments.update(comments => comments.filter(item => item.id !== comment.id))
        this.replies.update(replies => Object.fromEntries(Object.entries(replies).map(([ id, items ]) => [
          id, items.filter(item => item.id !== comment.id)
        ])))
        this.feedback.set('评论已删除')
        this.deleteTarget.set(null)
      },
      error: err => this.feedback.set(getGameActionErrorMessage(err))
    })
  }

  currentUserAvatar () {
    const user = this.authService.getUser()
    const label = user?.account?.displayName || user?.account?.name || user?.username || '我'
    return buildGameAvatarDataUrl(label)
  }

  commentAvatar (comment: GameComment) {
    return buildGameAvatarDataUrl(comment.account?.displayName || comment.account?.name || '玩家')
  }

  focusComposerInput () {
    const input = document.querySelector<HTMLInputElement>('.bili-comment-composer input')
    if (input) input.focus()
  }

  setCommentImage (image: File | null) { this.commentImage.set(image) }

  clearCommentImage () { this.commentImage.set(null) }

  private scrollDiscussToBottom () {
    const list = document.querySelector<HTMLElement>('.discuss-message-list')
    if (list) list.scrollTop = list.scrollHeight
  }

  ngOnDestroy () {
    this.stopPolling()
  }

  private load (uuid: string, sort: 'new' | 'hot') {
    if (!uuid) return
    this.gamesService.comments(uuid, sort, 0, 20).subscribe({
      next: result => {
        this.comments.set(result.data)
        this.total.set(result.total)
        this.loading.set(false)
        this.error.set('')
      },
      error: () => {
        this.comments.set([])
        this.total.set(0)
        this.loading.set(false)
        this.error.set('评论加载失败，请稍后重试')
      }
    })
  }

  private updateComment (commentId: number, patch: Partial<GameComment>) {
    this.comments.update(comments => comments.map(comment => comment.id === commentId ? { ...comment, ...patch } : comment))
    this.replies.update(replies => Object.fromEntries(Object.entries(replies).map(([ id, items ]) => [
      id, items.map(item => item.id === commentId ? { ...item, ...patch } : item)
    ])))
  }

  private startPolling () {
    this.stopPolling()
    this.refreshTimer = setInterval(() => this.refresh(), 4000)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  private stopPolling () {
    if (!this.refreshTimer) return
    clearInterval(this.refreshTimer)
    this.refreshTimer = undefined
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
  }

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.stopPolling()
    } else {
      this.startPolling()
    }
  }

  private refresh () {
    if (!this.uuid) return
    this.gamesService.comments(this.uuid, this.sort(), 0, 20).subscribe({
      next: result => {
        if (!result.data.length) return
        this.comments.set(result.data)
        this.total.set(result.total)
        this.error.set('')
      }
    })
  }

  private requireLogin () {
    if (this.authService.isLoggedIn()) return true
    void this.router.navigate([ '/login' ], { queryParams: { returnUrl: this.router.url } })
    return false
  }
}
