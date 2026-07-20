import { DatePipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core'
import { DomSanitizer, Meta, SafeResourceUrl, Title } from '@angular/platform-browser'
import { AuthService } from '@app/core/auth/auth.service'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { GamesService, Game, GameComment, GameCommunity, GameReview } from './games.service'
import { GameCardComponent } from './game-card.component'
import { getGameActionErrorMessage } from './game-action-feedback'
import { buildGameAvatarDataUrl } from '../shared/game-avatar'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

@Component({
  templateUrl: './game-play.component.html',
  styleUrl: './game-play.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ DatePipe, GameCardComponent, GlobalIconComponent, RouterLink ]
})
export class GamePlayComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly authService = inject(AuthService)
  private readonly gamesService = inject(GamesService)
  private readonly sanitizer = inject(DomSanitizer)
  private readonly meta = inject(Meta, { optional: true })
  private readonly titleService = inject(Title, { optional: true })
  private readonly iframe = viewChild<ElementRef<HTMLIFrameElement>>('gameFrame')
  private readonly subscriptions: { unsubscribe: () => void }[] = []
  private reloadKey = 0

  readonly game = signal<Game | null>(null)
  readonly loading = signal(true)
  readonly loadingError = signal(false)
  readonly skeletonPulse = signal(true)
  readonly frameLoading = signal(true)
  readonly runtimeUrl = signal<SafeResourceUrl | null>(null)
  readonly community = signal<GameCommunity | null>(null)
  readonly communityError = signal('')
  readonly comments = signal<GameComment[]>([])
  readonly commentsLoading = signal(true)
  readonly commentsError = signal('')
  readonly commentDraft = signal('')
  readonly reviews = signal<GameReview[]>([])
  readonly reviewsLoading = signal(true)
  readonly reviewsError = signal('')
  readonly reviewDraft = signal('')
  readonly reviewScore = signal(5)
  readonly reviewScores = [ 1, 2, 3, 4, 5 ]
  readonly replyTo = signal<number | null>(null)
  readonly coinAmount = signal<1 | 2>(1)
  readonly coinMessage = signal('')
  readonly coinLoading = signal(false)
  readonly related = signal<Game[]>([])
  readonly authorGames = signal<Game[]>([])
  readonly replies = signal<Record<number, GameComment[]>>({})
  readonly commentFeedback = signal('')
  readonly deleteTarget = signal<GameComment | null>(null)
  readonly mutedHint = signal(false)
  readonly soundEnabled = signal(true)
  readonly gameVolume = signal(1)
  readonly gameStarted = signal(false)
  readonly actionFeedback = signal('')
  readonly commentSort = signal<'latest' | 'hot'>('latest')
  readonly activeScreenshot = signal<number>(0)
  readonly tripleAnimating = signal(false)
  readonly tripleApplied = signal(false)
  readonly shareDialog = signal(false)
  readonly shareUrl = signal('')
  readonly shareCopied = signal(false)
  readonly relatedArticles = signal<{ id: number; title: string; slug: string; summary: string; category: string }[]>([])
  readonly reportDialog = signal(false)
  readonly reportReason = signal('')
  readonly reportPredefined = signal<string[]>([])
  readonly reportSubmitting = signal(false)
  readonly reportFeedback = signal('')
  readonly reportReasons = [
    '色情低俗', '暴力血腥', '违法违规', '侵权抄袭',
    '恶意代码', '无法运行', '垃圾内容', '其他'
  ]
  readonly sortedComments = computed(() => {
    const comments = [ ...this.comments() ]
    if (this.commentSort() === 'hot') return comments.sort((a, b) => (b.likes || 0) - (a.likes || 0))
    return comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  })
  private currentUuid = ''
  private playRecordedFor = ''
  private commentsRefreshTimer: ReturnType<typeof setInterval> | undefined

  ngOnInit () {
    const sub = this.route.paramMap.subscribe(params => this.loadGame(params.get('uuid') || ''))
    this.subscriptions.push(sub)
  }

  ngOnDestroy () {
    this.stopCommentsPolling()
    this.subscriptions.forEach(subscription => subscription.unsubscribe())
  }

  loadGame (uuid: string) {
    if (!uuid) return

    this.currentUuid = uuid
    this.stopCommentsPolling()

    this.loading.set(true)
    this.loadingError.set(false)
    this.frameLoading.set(true)
    this.runtimeUrl.set(null)
    this.community.set(null)
    this.communityError.set('')
    this.comments.set([])
    this.commentsLoading.set(true)
    this.commentsError.set('')
    this.reviews.set([])
    this.reviewsLoading.set(true)
    this.reviewsError.set('')
    this.reviewDraft.set('')
    this.reviewScore.set(5)
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
        this.updateMetaTags(game)
        this.gameStarted.set(false)
        this.runtimeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.withReloadKey(game.runtimeUrl)))
        this.loading.set(false)
        this.gamesService.community(uuid).subscribe({
          next: community => this.community.set(community),
          error: () => this.communityError.set('互动操作暂时无法加载，请稍后重试。')
        })
        this.gamesService.comments(uuid, this.commentSort()).subscribe({
          next: result => {
            this.comments.set(result.data)
            this.commentsLoading.set(false)
          },
          error: () => {
            this.commentsLoading.set(false)
            this.commentsError.set('评论暂时无法加载，请稍后重试。')
          }
        })
        this.gamesService.reviews(uuid).subscribe({
          next: result => {
            this.reviews.set(result.data)
            this.reviewsLoading.set(false)
          },
          error: () => {
            this.reviewsLoading.set(false)
            this.reviewsError.set('评价暂时无法加载，请稍后重试。')
          }
        })
        this.startCommentsPolling()
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
        // Load related articles based on tags (uses tag-based search as articles API not yet available)
        if (game.tags?.length) {
          const firstTag = game.tags[0]
          this.gamesService.list({ search: firstTag, count: 3, sort: 'likes' }).subscribe({
            next: result => this.relatedArticles.set(
              result.data
                .filter(item => item.uuid !== game.uuid)
                .slice(0, 3)
                .map(item => ({
                  id: 0,
                  title: item.title,
                  slug: item.uuid,
                  summary: item.description || '查看这个相关游戏',
                  category: item.category
                }))
            )
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

  tripleAction () {
    if (!this.requireLogin()) return
    if (this.tripleAnimating() || this.tripleApplied()) return
    this.tripleAnimating.set(true)
    this.actionFeedback.set('')
    this.gamesService.triple(this.currentUuid).subscribe({
      next: result => {
        this.tripleAnimating.set(false)
        this.tripleApplied.set(result.liked || result.coined || result.favorited)

        const messages: string[] = []
        if (result.liked) messages.push('点赞')
        if (result.coined) messages.push('投币')
        if (result.favorited) messages.push('收藏')
        this.actionFeedback.set('一键三连' + (messages.length ? '：' + messages.join(' + ') : '已完成'))

        // Refresh community stats
        this.gamesService.community(this.currentUuid).subscribe({
          next: value => this.community.set(value)
        })
      },
      error: error => {
        this.tripleAnimating.set(false)
        this.actionFeedback.set(getGameActionErrorMessage(error))
      }
    })
  }

  tripleAction () {
    if (!this.requireLogin()) return
    const current = this.community()
    if (!current || current.isOwner) return
    this.gamesService.triple(this.currentUuid).subscribe({
      next: (value) => {
        this.actionFeedback.set('一键三连成功！')
        this.gamesService.community(this.currentUuid).subscribe({
          next: state => this.community.set(state)
        })
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

  toggleGameSound () {
    this.setGameVolume(this.gameVolume() > 0 ? 0 : 1)
  }

  onGameVolumeChange (event: Event) {
    this.setGameVolume(Number((event.target as HTMLInputElement).value))
  }

  setCommentSort (sort: 'hot' | 'latest') {
    this.commentSort.set(sort)
    this.commentsLoading.set(true)
    this.gamesService.comments(this.currentUuid, sort).subscribe({
      next: result => {
        this.comments.set(result.data)
        this.commentsLoading.set(false)
      },
      error: () => {
        this.commentsLoading.set(false)
        this.commentsError.set('评论重新加载失败')
      }
    })
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

  submitReview () {
    if (!this.requireLogin()) return
    const text = this.reviewDraft().trim()
    if (!text) return
    this.gamesService.review(this.currentUuid, this.reviewScore(), text).subscribe({
      next: result => {
        this.reviews.update(reviews => [ result.review, ...reviews.filter(review => review.id !== result.review.id) ])
        this.reviewDraft.set('')
        this.commentFeedback.set('评价已发布')
      },
      error: error => this.reviewsError.set(getGameActionErrorMessage(error))
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
    const currentGame = this.game()
    if (!currentGame) return
    try {
      const result = await this.gamesService.share(currentGame.uuid).toPromise()
      const url = result?.shortUrl || window.location.href
      if (navigator.share) {
        await navigator.share({ title: currentGame.title, url })
      } else {
        this.shareUrl.set(url)
        this.shareDialog.set(true)
      }
    } catch {
      this.actionFeedback.set('分享未完成')
    }
  }

  copyShareUrl () {
    navigator.clipboard?.writeText(this.shareUrl()).then(() => {
      this.shareCopied.set(true)
      setTimeout(() => this.shareCopied.set(false), 2000)
    })
  }

  closeShareDialog () {
    this.shareDialog.set(false)
    this.shareCopied.set(false)
  }

  openReportDialog () {
    if (!this.requireLogin()) return
    this.reportDialog.set(true)
    this.reportReason.set('')
    this.reportPredefined.set([])
    this.reportFeedback.set('')
  }

  toggleReportPredefined (reason: string) {
    this.reportPredefined.update(list =>
      list.includes(reason) ? list.filter(r => r !== reason) : [...list, reason]
    )
  }

  submitReport () {
    const reason = this.reportReason().trim()
    if (!reason && this.reportPredefined().length === 0) {
      this.reportFeedback.set('请选择或填写举报原因')
      return
    }
    this.reportSubmitting.set(true)
    this.gamesService.report(
      this.currentUuid,
      reason || this.reportPredefined().join(', '),
      this.reportPredefined()
    ).subscribe({
      next: () => {
        this.reportSubmitting.set(false)
        this.reportFeedback.set('举报已提交，我们会尽快处理')
        setTimeout(() => this.reportDialog.set(false), 2000)
      },
      error: error => {
        this.reportSubmitting.set(false)
        this.reportFeedback.set(getGameActionErrorMessage(error))
      }
    })
  }

  closeReportDialog () {
    this.reportDialog.set(false)
    this.reportFeedback.set('')
  }

  private updateMetaTags (game: Game) {
    if (!this.titleService || !this.meta) return

    const title = `${game.title} - GameHub`
    this.titleService.setTitle(title)

    const baseUrl = window.location.origin
    const gameUrl = `${baseUrl}/games/${game.uuid}`
    const description = game.description?.slice(0, 200) || '试玩这个有趣的网页小游戏'

    this.setMeta('description', description)
    this.setMeta('og:title', title)
    this.setMeta('og:description', description)
    this.setMeta('og:url', gameUrl)
    this.setMeta('og:type', 'article')
    this.setMeta('og:site_name', 'GameHub')
    this.setMeta('twitter:card', 'summary_large_image')
    this.setMeta('twitter:title', title)
    this.setMeta('twitter:description', description)
    this.setMeta('twitter:url', gameUrl)

    if (game.coverPath) {
      this.setMeta('og:image', game.coverPath)
      this.setMeta('twitter:image', game.coverPath)
    }
  }

  private setMeta (name: string, content: string) {
    if (!this.meta) return

    const isProperty = name.startsWith('og:')
    const key = isProperty ? 'property' : 'name'
    const existing = this.meta.getTag(`${key}="${name}"`)
    if (existing) {
      this.meta.updateTag({ [key]: name, content })
    } else {
      this.meta.addTag({ [key]: name, content })
    }
  }

  focusGame () {
    this.iframe()?.nativeElement.focus()
    this.mutedHint.set(true)
  }

  formatBigNumber (value: number | undefined) {
    if (!value || value < 1) return '0'
    if (value >= 10000) return (value / 10000).toFixed(1) + '万'
    return String(value)
  }

  @HostListener('document:keydown', [ '$event' ])
  onKeydown (event: KeyboardEvent) {
    // Only handle when game is loaded and user is not typing in an input
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
    if (!this.game() || this.loading()) return

    if (event.code === 'Space') {
      event.preventDefault()
      if (this.gameStarted()) {
        this.reloadGame()
      } else {
        this.startGame()
      }
    } else if (event.key === 'f' || event.key === 'F') {
      event.preventDefault()
      this.enterFullscreen()
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault()
      this.reloadGame()
    }
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

  getDeveloperAvatar (label: string) {
    return buildGameAvatarDataUrl(label)
  }

  onFrameLoaded () {
    this.frameLoading.set(false)
    this.syncGameVolume()
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

  private setGameVolume (volume: number) {
    const nextVolume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1
    this.gameVolume.set(nextVolume)
    this.soundEnabled.set(nextVolume > 0)
    this.syncGameVolume()
  }

  private syncGameVolume () {
    this.iframe()?.nativeElement.contentWindow?.postMessage({
      type: 'gamehub:set-volume',
      enabled: this.gameVolume() > 0,
      volume: this.gameVolume()
    }, '*')
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

  private startCommentsPolling () {
    this.stopCommentsPolling()
    this.commentsRefreshTimer = setInterval(() => this.refreshComments(), 4000)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  private stopCommentsPolling () {
    if (!this.commentsRefreshTimer) return
    clearInterval(this.commentsRefreshTimer)
    this.commentsRefreshTimer = undefined
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
  }

  private onVisibilityChange = () => {
    if (document.hidden) {
      this.stopCommentsPolling()
    } else {
      this.startCommentsPolling()
    }
  }

  private refreshComments () {
    if (!this.currentUuid) return
    this.gamesService.comments(this.currentUuid).subscribe({
      next: result => {
        this.comments.set(result.data)
        this.commentsError.set('')
      }
    })
  }
}
