import { ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { GamesService, Game, GameComment, GameCommunity } from './games.service'

@Component({
  templateUrl: './game-play.component.html',
  styleUrl: './game-play.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink ]
})
export class GamePlayComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute)
  private readonly gamesService = inject(GamesService)
  private readonly iframe = viewChild<ElementRef<HTMLIFrameElement>>('gameFrame')
  private readonly subscriptions: { unsubscribe: () => void }[] = []
  private reloadKey = 0

  readonly game = signal<Game | null>(null)
  readonly loading = signal(true)
  readonly loadingError = signal(false)
  readonly frameLoading = signal(true)
  readonly runtimeUrl = signal('')
  readonly community = signal<GameCommunity | null>(null)
  readonly comments = signal<GameComment[]>([])
  readonly commentDraft = signal('')
  readonly reportReason = signal('')
  private currentUuid = ''

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
    this.gamesService.get(uuid).subscribe({
      next: game => {
        this.game.set(game)
        this.runtimeUrl.set(this.withReloadKey(game.runtimeUrl))
        this.loading.set(false)
        this.gamesService.recordPlay(uuid).subscribe()
        this.gamesService.community(uuid).subscribe({ next: community => this.community.set(community) })
        this.gamesService.comments(uuid).subscribe({ next: result => this.comments.set(result.data) })
      },
      error: () => {
        this.loading.set(false)
        this.loadingError.set(true)
      }
    })
  }

  toggleRate (rating: 'like' | 'dislike') {
    const current = this.community()
    if (!current) return
    const next = current.rating === rating ? 'none' : rating
    this.gamesService.rate(this.currentUuid, next).subscribe({
      next: () => this.gamesService.community(this.currentUuid).subscribe({ next: value => this.community.set(value) })
    })
  }

  toggleFavorite () {
    const current = this.community()
    if (!current) return
    this.gamesService.favorite(this.currentUuid, !current.favorite).subscribe({
      next: value => this.community.update(state => state ? { ...state, favorite: value.favorite } : state)
    })
  }

  toggleFollow () {
    const current = this.community()
    if (!current) return
    this.gamesService.follow(this.currentUuid, !current.following).subscribe({
      next: value => this.community.update(state => state ? { ...state, following: value.following } : state)
    })
  }

  submitComment () {
    const text = this.commentDraft().trim()
    if (!text) return
    this.gamesService.comment(this.currentUuid, text).subscribe({
      next: result => {
        this.comments.update(comments => [ ...comments, result.comment ])
        this.commentDraft.set('')
      }
    })
  }

  reportGame () {
    const reason = this.reportReason().trim()
    if (reason) this.gamesService.report(this.currentUuid, reason).subscribe()
  }

  reloadGame () {
    const currentGame = this.game()
    if (!currentGame) return

    this.reloadKey++
    this.frameLoading.set(true)
    this.loadingError.set(false)
    this.runtimeUrl.set(this.withReloadKey(currentGame.runtimeUrl))
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
}
