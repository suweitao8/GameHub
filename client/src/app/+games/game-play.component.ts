import { DatePipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core'
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser'
import { AuthService } from '@app/core/auth/auth.service'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { GamesService, Game, GameComment, GameCommunity } from './games.service'
import { GameCardComponent } from './game-card.component'
import { getGameActionErrorMessage } from './game-action-feedback'

@Component({
  templateUrl: './game-play.component.html',
  styleUrl: './game-play.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ DatePipe, GameCardComponent, RouterLink ]
})
export class GamePlayComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly authService = inject(AuthService)
  private readonly gamesService = inject(GamesService)
  private readonly sanitizer = inject(DomSanitizer)
  private readonly iframe = viewChild<ElementRef<HTMLIFrameElement>>('gameFrame')
  private readonly subscriptions: { unsubscribe: () => void }[] = []
  private reloadKey = 0

  readonly game = signal<Game | null>(null)
  readonly loading = signal(true)
  readonly loadingError = signal(false)
  readonly frameLoading = signal(true)
  readonly runtimeUrl = signal<SafeResourceUrl | null>(null)
  readonly community = signal<GameCommunity | null>(null)
  readonly communityError = signal('')
  readonly comments = signal<GameComment[]>([])
  readonly commentsLoading = signal(true)
  readonly commentsError = signal('')
  readonly commentDraft = signal('')
  readonly replyTo = signal<number | null>(null)
  readonly reportReason = signal('')
  readonly coinAmount = signal<1 | 2>(1)
  readonly coinMessage = signal('')
  readonly coinLoading = signal(false)
  readonly related = signal<Game[]>([])
  readonly authorGames = signal<Game[]>([])
  readonly replies = signal<Record<number, GameComment[]>>({})
  readonly commentFeedback = signal('')
  readonly deleteTarget = signal<GameComment | null>(null)
  readonly reportTarget = signal<GameComment | null>(null)
  readonly reportDraft = signal('')
  readonly mutedHint = signal(false)
  readonly gameStarted = signal(false)
  readonly actionFeedback = signal('')
  readonly commentSort = signal<'latest' | 'hot'>('latest')
  readonly sortedComments = computed(() => {
    const comments = [ ...this.comments() ]
    if (this.commentSort() === 'hot') return comments.sort((a, b) => (b.likes || 0) - (a.likes || 0))
    return comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  })
  private currentUuid = ''
  private playRecordedFor = ''

  ngOnInit () {
    const sub = this.route.paramMap.subscribe(params => this.loadGame(params.get('uuid') || ''))
    this.subscriptions.push(sub)
  }

  ngOnDestroy () {
    this.subscriptions.forEach(subscription => subscription.unsubscribe())
  }

  loadGame (uuid: string) {
    if (!uuid) return

    this.currentUuid = uuid

    this.loading.set(true)
    this.loadingError.set(false)
    this.frameLoading.set(true)
    this.runtimeUrl.set(null)
    this.community.set(null)
    this.communityError.set('')
    this.comments.set([])
    this.commentsLoading.set(true)
    this.commentsError.set('')
    this.related.set([])
    this.authorGames.set([])
    this.replies.set({})
    this.actionFeedback.set('')
    this.commentFeedback.set('')
    this.coinMessage.set('')
    this.playRecordedFor = ''
    this.gamesService.get(uuid).subscribe({
      next: game => {
        this.game.set(game)
        this.gameStarted.set(false)
        this.runtimeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.withReloadKey(game.runtimeUrl)))
        this.loading.set(false)
        this.gamesService.community(uuid).subscribe({
          next: community => this.community.set(community),
          error: () => this.communityError.set('互动操作暂时无法加载，请稍后重试。')
        })
        this.gamesService.comments(uuid).subscribe({
          next: result => {
            this.comments.set(result.data)
            this.commentsLoading.set(false)
          },
          error: () => {
            this.commentsLoading.set(false)
            this.commentsError.set('评论暂时无法加载，请稍后重试。')
          }
        })
        this.gamesService.list({ category: game.category, count: 4, sort: 'popular' }).subscribe({
          next: result => this.related.set(result.data.filter(item => item.uuid !== game.uuid))
        })
        if (game.author?.name) {
          this.gamesService.list({ search: game.author.name, count: 3, sort: 'latest' }).subscribe({
            next: result => this.authorGames.set(result.data.filter(item =>
              item.ownerAccountId === game.ownerAccountId && item.uuid !== game.uuid
            ))
          })
        }
      },
      error: () => {
        this.loading.set(false)
        this.loadingError.set(true)
      }
    })
  }

  toggleRate (rating: 'like') {
    if (!this.requireLogin()) return
    const current = this.community()
    if (!current) return
    const next = current.rating === rating ? 'none' : rating
    this.gamesService.rate(this.currentUuid, next).subscribe({
      next: () => this.gamesService.community(this.currentUuid).subscribe({
        next: value => {
          this.community.set(value)
          this.actionFeedback.set(next === 'like' ? '点赞成功' : next === 'none' ? '已取消点赞' : '已记录你的反馈')
        }
      }),
      error: error => this.actionFeedback.set(getGameActionErrorMessage(error))
    })
  }

  toggleFavorite () {
    if (!this.requireLogin()) return
    const current = this.community()
    if (!current) return
    this.gamesService.favorite(this.currentUuid, !current.favorite).subscribe({
      next: value => {
        this.community.update(state => state ? { ...state, favorite: value.favorite } : state)
        this.actionFeedback.set(value.favorite ? '已加入收藏' : '已取消收藏')
      },
      error: error => this.actionFeedback.set(getGameActionErrorMessage(error))
    })
  }

  toggleFollow () {
    if (!this.requireLogin()) return
    const current = this.community()
    if (!current) return
    this.gamesService.follow(this.currentUuid, !current.following).subscribe({
      next: value => {
        this.community.update(state => state ? { ...state, following: value.following } : state)
        this.actionFeedback.set(value.following ? '已关注作者' : '已取消关注')
      },
      error: error => this.actionFeedback.set(getGameActionErrorMessage(error))
    })
  }

  startGame () {
    this.gameStarted.set(true)
    if (this.playRecordedFor !== this.currentUuid) {
      this.playRecordedFor = this.currentUuid
      this.gamesService.recordPlay(this.currentUuid).subscribe({ error: () => this.playRecordedFor = '' })
    }
    this.focusGame()
  }

  submitComment () {
    if (!this.requireLogin()) return
    const text = this.commentDraft().trim()
    if (!text) return
    this.gamesService.comment(this.currentUuid, text).subscribe({
      next: result => {
        this.comments.update(comments => [ ...comments, result.comment ])
        this.commentDraft.set('')
      },
      error: error => this.commentFeedback.set(getGameActionErrorMessage(error))
    })
  }

  submitReply () {
    if (!this.requireLogin()) return
    const parentId = this.replyTo()
    const text = this.commentDraft().trim()
    if (!parentId || !text) return
    this.gamesService.reply(this.currentUuid, parentId, text).subscribe({
      next: result => {
        this.comments.update(comments => comments.map(comment => comment.id === parentId
          ? { ...comment, totalReplies: (comment.totalReplies || 0) + 1 }
          : comment))
        this.commentDraft.set('')
        this.replyTo.set(null)
        this.replies.update(replies => ({
          ...replies,
          [parentId]: [ ...(replies[parentId] || []), result.comment ]
        }))
      },
      error: error => this.commentFeedback.set(getGameActionErrorMessage(error))
    })
  }

  toggleCommentLike (comment: GameComment) {
    if (!this.requireLogin()) return
    this.gamesService.likeComment(this.currentUuid, comment.id, !comment.liked).subscribe({
      next: value => this.updateComment(comment.id, { liked: value.liked, likes: value.likes }),
      error: error => this.commentFeedback.set(getGameActionErrorMessage(error))
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

    this.gamesService.replies(this.currentUuid, comment.id).subscribe({
      next: result => this.replies.update(replies => ({ ...replies, [comment.id]: result.data })),
      error: error => this.commentFeedback.set(getGameActionErrorMessage(error))
    })
  }

  requestDeleteComment (comment: GameComment) {
    if (comment.canDelete) this.deleteTarget.set(comment)
  }

  confirmDeleteComment () {
    if (!this.requireLogin()) return
    const comment = this.deleteTarget()
    if (!comment) return
    this.gamesService.deleteComment(this.currentUuid, comment.id).subscribe({
      next: () => {
        this.comments.update(comments => comments.filter(item => item.id !== comment.id))
        this.replies.update(replies => Object.fromEntries(Object.entries(replies).map(([ id, items ]) => [
          id, items.filter(item => item.id !== comment.id)
        ])))
        this.commentFeedback.set('评论已删除')
        this.deleteTarget.set(null)
      },
      error: error => this.commentFeedback.set(getGameActionErrorMessage(error))
    })
  }

  requestReportComment (comment: GameComment) {
    this.reportTarget.set(comment)
    this.reportDraft.set('')
  }

  submitReportComment () {
    if (!this.requireLogin()) return
    const comment = this.reportTarget()
    const reason = this.reportDraft().trim()
    if (!comment || !reason) return
    this.gamesService.reportComment(this.currentUuid, comment.id, reason).subscribe({
      next: () => {
        this.commentFeedback.set('已提交评论举报')
        this.reportTarget.set(null)
      },
      error: error => this.commentFeedback.set(getGameActionErrorMessage(error))
    })
  }

  reportGame () {
    if (!this.requireLogin()) return
    const reason = this.reportReason().trim()
    if (!reason) return

    this.gamesService.report(this.currentUuid, reason).subscribe({
      next: () => {
        this.reportReason.set('')
        this.actionFeedback.set('举报已提交')
      },
      error: error => this.actionFeedback.set(getGameActionErrorMessage(error))
    })
  }

  giveCoin () {
    if (!this.requireLogin()) return
    const state = this.community()
    if (!state || this.coinLoading()) return
    this.coinLoading.set(true)
    this.coinMessage.set('')
    this.gamesService.coin(this.currentUuid, this.coinAmount()).subscribe({
      next: value => {
        this.coinLoading.set(false)
        this.coinMessage.set(`投币成功，已投入 ${value.coinsGiven} 枚，余额 ${value.coinBalance} 枚`)
        this.community.update(current => current
          ? { ...current, coins: current.coins + this.coinAmount(), coinBalance: value.coinBalance, coinsGiven: value.coinsGiven }
          : current)
      },
      error: error => {
        this.coinLoading.set(false)
        this.coinMessage.set(getGameActionErrorMessage(error))
      }
    })
  }

  async shareGame () {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: this.game()?.title, url })
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        this.actionFeedback.set('链接已复制')
      } else {
        this.actionFeedback.set('当前浏览器不支持分享')
      }
    } catch {
      this.actionFeedback.set('分享未完成')
    }
  }

  focusGame () {
    this.iframe()?.nativeElement.focus()
    this.mutedHint.set(true)
  }

  reloadGame () {
    const currentGame = this.game()
    if (!currentGame) return

    this.reloadKey++
    this.frameLoading.set(true)
    this.gameStarted.set(false)
    this.loadingError.set(false)
    this.runtimeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.withReloadKey(currentGame.runtimeUrl)))
  }

  retryLoadGame () {
    this.loadGame(this.currentUuid)
  }

  downloadGame () {
    window.location.assign(this.gamesService.buildDownloadUrl(this.currentUuid))
  }

  onFrameLoaded () {
    this.frameLoading.set(false)
  }

  onFrameError () {
    this.frameLoading.set(false)
    this.loadingError.set(true)
  }

  async enterFullscreen () {
    const frame = this.iframe()?.nativeElement
    if (!frame) return

    await frame.requestFullscreen?.()
  }

  private withReloadKey (url: string) {
    return `${url}${url.includes('?') ? '&' : '?'}reload=${this.reloadKey}`
  }

  private requireLogin () {
    if (this.authService.isLoggedIn()) return true
    void this.router.navigate([ '/login' ], { queryParams: { returnUrl: this.router.url } })
    return false
  }

  private updateComment (commentId: number, patch: Partial<GameComment>) {
    this.comments.update(comments => comments.map(comment => comment.id === commentId ? { ...comment, ...patch } : comment))
    this.replies.update(replies => Object.fromEntries(Object.entries(replies).map(([ id, items ]) => [
      id, items.map(item => item.id === commentId ? { ...item, ...patch } : item)
    ])))
  }
}
