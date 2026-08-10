import { DatePipe } from '@angular/common'
import {
  ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, inject, OnDestroy, OnInit, signal, viewChild
} from '@angular/core'
import { DomSanitizer, Meta, SafeResourceUrl, Title } from '@angular/platform-browser'
import { AuthService } from '@app/core/auth/auth.service'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { GamesService, Game, GameCommunity, GameRelatedGame } from './games.service'
import { buildGameAvatarDataUrl } from '../shared/game-avatar'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { WatchLaterService } from './watch-later.service'
import { GameRecommendService } from './game-recommend.service'
import { updateGameMetaTags } from './services/game-meta-tags'
import { GameScreenshotsComponent } from './game-screenshots.component'
import { GameShareDialogComponent } from './game-share-dialog.component'
import { GameReportDialogComponent } from './game-report-dialog.component'
import { GameCommentsComponent } from './game-comments.component'
import { GameDiscussComponent } from './game-discuss.component'
import { GameCommunityPanelComponent } from './game-community-panel.component'
import { GameCommentsStore } from './game-comments-store'
import { GameDiscussStore } from './game-discuss-store'

@Component({
  templateUrl: './game-play.component.html',
  styleUrl: './game-play.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ GameCommentsStore, GameDiscussStore ],
  imports: [
    DatePipe, GlobalIconComponent, RouterLink,
    GameScreenshotsComponent, GameShareDialogComponent, GameReportDialogComponent,
    GameCommentsComponent, GameDiscussComponent, GameCommunityPanelComponent
  ]
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
  private readonly shareDialog = viewChild(GameShareDialogComponent)
  private readonly subscriptions: { unsubscribe: () => void }[] = []
  private readonly recommendService = inject(GameRecommendService)
  readonly commentsStore = inject(GameCommentsStore)
  readonly discussStore = inject(GameDiscussStore)
  readonly watchLaterService = inject(WatchLaterService)
  private reloadKey = 0
  private playRecordedFor = ''
  private loadGeneration = 0
  /** Current game uuid, exposed read-only for child component bindings. */
  currentUuid = ''

  readonly game = signal<Game | null>(null)
  readonly loading = signal(true)
  readonly loadingError = signal(false)
  readonly frameLoading = signal(true)
  readonly runtimeUrl = signal<SafeResourceUrl | null>(null)
  readonly community = signal<GameCommunity | null>(null)
  readonly communityError = signal('')
  readonly developerGames = signal<GameRelatedGame[]>([])
  readonly related = signal<GameRelatedGame[]>([])
  readonly relatedCoverBroken = signal<Record<string, boolean>>({})
  readonly soundEnabled = signal(true)
  readonly gameVolume = signal(1)
  readonly showBackToTop = signal(false)
  readonly shareOpen = signal(false)
  readonly reportOpen = signal(false)
  readonly inWatchLater = signal(false)
  readonly watchLaterFeedback = signal('')

  /** Comment count badge in the title bar (driven by the comment store). */
  readonly commentCount = computed(() =>
    this.commentsStore.commentCount() || this.commentsStore.total() || this.commentsStore.comments().length || 0
  )

  ngOnInit () {
    const sub = this.route.paramMap.subscribe(params => this.loadGame(params.get('uuid') || ''))
    this.subscriptions.push(sub)
    window.addEventListener('scroll', this.onScroll, { passive: true })
  }

  ngOnDestroy () {
    this.loadGeneration += 1
    this.subscriptions.forEach(s => s.unsubscribe())
    window.removeEventListener('scroll', this.onScroll)
  }

  onScroll = () => { this.showBackToTop.set(window.scrollY > 600) }

  scrollToTop () { window.scrollTo({ top: 0, behavior: 'smooth' }) }

  loadGame (uuid: string) {
    const generation = ++this.loadGeneration
    if (!uuid) return
    this.currentUuid = uuid
    this.commentsStore.setUuid(uuid)
    this.discussStore.init(uuid)
    this.loading.set(true)
    this.loadingError.set(false)
    this.frameLoading.set(true)
    this.runtimeUrl.set(null)
    this.community.set(null)
    this.communityError.set('')
    this.developerGames.set([])
    this.related.set([])
    this.relatedCoverBroken.set({})
    this.playRecordedFor = ''
    this.inWatchLater.set(this.watchLaterService.has(uuid))
    this.gamesService.get(uuid).subscribe({
      next: game => {
        if (generation !== this.loadGeneration || this.currentUuid !== uuid) return
        this.game.set(game)
        this.recommendService.recordView(game)
        this.updateMetaTags(game)
        this.runtimeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.withReloadKey(game.runtimeUrl)))
        this.loading.set(false)
        this.commentsStore.init(uuid)
        this.gamesService.community(uuid).subscribe({
          next: value => {
            if (generation !== this.loadGeneration || this.currentUuid !== uuid) return
            this.community.set(value)
          },
          error: () => {
            if (generation !== this.loadGeneration || this.currentUuid !== uuid) return
            this.communityError.set('互动操作暂时无法加载，请稍后重试。')
          }
        })
        this.gamesService.related(uuid, 8).subscribe({
          next: result => {
            if (generation !== this.loadGeneration || this.currentUuid !== uuid) return
            this.developerGames.set(result.developerGames)
            this.related.set(result.relatedGames)
          }
        })
      },
      error: () => {
        if (generation !== this.loadGeneration || this.currentUuid !== uuid) return
        this.loading.set(false)
        this.loadingError.set(true)
      }
    })
  }

  toggleFollow () {
    if (!this.requireLogin()) return
    const current = this.community()
    if (!current) return
    this.gamesService.follow(this.currentUuid, !current.following).subscribe({
      next: value => this.community.update(state => state ? { ...state, following: value.following } : state)
    })
  }

  toggleGameSound () { this.setGameVolume(this.gameVolume() > 0 ? 0 : 1) }

  onGameVolumeChange (event: Event) { this.setGameVolume(Number((event.target as HTMLInputElement).value)) }

  async shareGame () {
    if (!this.requireLogin()) return
    const dialog = this.shareDialog()
    if (dialog && await dialog.share()) this.shareOpen.set(true)
  }

  toggleWatchLater () {
    const currentGame = this.game()
    if (!currentGame) return
    const added = this.watchLaterService.toggle(currentGame)
    this.inWatchLater.set(added)
    this.watchLaterFeedback.set(added ? '已加入「稍后再玩」' : '已从「稍后再玩」移除')
    setTimeout(() => this.watchLaterFeedback.set(''), 2000)
  }

  formatBigNumber (value: number | undefined) {
    if (!value || value < 1) return '0'
    if (value >= 10000) return (value / 10000).toFixed(1) + '万'
    return String(value)
  }

  getDeveloperAvatar (label: string) { return buildGameAvatarDataUrl(label) }

  onRelatedCoverError (uuid: string) {
    this.relatedCoverBroken.update(state => ({ ...state, [uuid]: true }))
  }

  @HostListener('document:keydown', [ '$event' ])
  onKeydown (event: KeyboardEvent) {
    // Lightbox ESC/arrows are handled by the screenshots component.
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
    if (!this.game() || this.loading()) return
    if (event.key === 'f' || event.key === 'F') {
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
    this.loadingError.set(false)
    this.runtimeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.withReloadKey(currentGame.runtimeUrl)))
  }

  retryLoadGame () { this.loadGame(this.currentUuid) }

  onFrameLoaded () {
    this.frameLoading.set(false)
    if (this.playRecordedFor !== this.currentUuid) {
      this.playRecordedFor = this.currentUuid
      this.gamesService.recordPlay(this.currentUuid).subscribe({ error: () => { this.playRecordedFor = '' } })
    }
    this.syncGameVolume()
  }

  onFrameError () { this.frameLoading.set(false); this.loadingError.set(true) }

  async enterFullscreen () {
    const frame = this.iframe()?.nativeElement
    if (frame) await frame.requestFullscreen?.()
  }

  private updateMetaTags (game: Game) {
    if (this.titleService && this.meta) updateGameMetaTags(game, this.meta, this.titleService)
  }

  private withReloadKey (url: string) {
    return `${url}${url.includes('?') ? '&' : '?'}reload=${this.reloadKey}`
  }

  private setGameVolume (volume: number) {
    const next = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1
    this.gameVolume.set(next)
    this.soundEnabled.set(next > 0)
    this.syncGameVolume()
  }

  private syncGameVolume () {
    this.iframe()?.nativeElement.contentWindow?.postMessage({
      type: 'gamehub:set-volume', enabled: this.gameVolume() > 0, volume: this.gameVolume()
    }, '*')
  }

  private requireLogin () {
    if (this.authService.isLoggedIn()) return true
    void this.router.navigate([ '/login' ], { queryParams: { returnUrl: this.router.url } })
    return false
  }
}
