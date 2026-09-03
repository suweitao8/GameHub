import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core'
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router'
import { AuthService, AuthStatus, AuthUser, HotkeysService, MenuService, RedirectService, ScreenService, ServerService } from '@app/core'
import { QuickSettingsModalComponent } from '@app/menu/quick-settings-modal.component'
import { ActorAvatarComponent } from '@app/shared/shared-actor-image/actor-avatar.component'
import { PeertubeModalService } from '@app/shared/shared-main/peertube-modal/peertube-modal.service'
import { SignupLabelComponent } from '@app/shared/shared-main/users/signup-label.component'
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap'
import { findAppropriateImage } from '@peertube/peertube-core-utils'
import { HTMLServerConfig, ServerConfig } from '@peertube/peertube-models'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { isAndroid, isIOS, isIphone } from '@root-helpers/web-browser'
import { shareReplay, Subscription } from 'rxjs'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../shared/shared-main/buttons/button.component'
import { buildGameAvatarDataUrl } from '../shared/game-avatar'
import { buildGameCoverDataUrl, getGameCoverPresetUrl } from '../shared/game-cover'
import { HeaderService } from './header.service'
import { GameNavigationComponent } from './game-navigation.component'
import { GameNotificationBadgeService } from './game-notification-badge.service'
import { Game, GameNotification, GamesService } from '@app/+games/games.service'
import { AuthModalService } from '@app/+login/auth-modal.service'
import { GAME_FEATURES } from '@app/+games/shared'

type GameHeaderPopup = 'notifications' | 'favorites' | 'history' | 'creator'

@Component({
  selector: 'my-header',
  templateUrl: './header.component.html',
  styleUrls: [ './header.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    ActorAvatarComponent,
    SignupLabelComponent,
    QuickSettingsModalComponent,
    GlobalIconComponent,
    RouterLink,
    NgbDropdownModule,
    RouterLinkActive,
    ButtonComponent,
    GameNavigationComponent
  ]
})
export class HeaderComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService)
  private serverService = inject(ServerService)
  private redirectService = inject(RedirectService)
  private hotkeysService = inject(HotkeysService)
  private screenService = inject(ScreenService)
  private modalService = inject(PeertubeModalService)
  private router = inject(Router)
  private menu = inject(MenuService)
  private headerService = inject(HeaderService)
  private gamesService = inject(GamesService)
  private authModal = inject(AuthModalService)
  readonly gameNotificationBadge = inject(GameNotificationBadgeService)

  /** 创作中心功能开关，模板用此属性控制入口显隐 */
  readonly creatorEnabled = GAME_FEATURES.creatorCenter

  private static LS_HIDE_MOBILE_MSG = 'hide-mobile-msg'

  readonly quickSettingsModal = viewChild<QuickSettingsModalComponent>('quickSettingsModal')
  readonly gameAvatarButton = viewChild<ElementRef<HTMLButtonElement>>('gameAvatarButton')
  readonly gameCoinBalance = signal<number | null>(null)
  readonly gameCount = signal<number | null>(null)
  readonly gameNavFavorites = signal<Game[]>([])
  readonly gameNavRecent = signal<Game[]>([])
  readonly gameNavOwned = signal<Game[]>([])
  readonly gameNavNotifications = signal<GameNotification[]>([])
  readonly gameNavLoading = signal<Record<GameHeaderPopup, boolean>>({
    notifications: false,
    favorites: false,
    history: false,
    creator: false
  })
  readonly gameNavCoverFallbacks = signal<Record<string, boolean>>({})
  readonly gameNavPresetFallbacks = signal<Record<string, boolean>>({})

  user: AuthUser
  loggedIn: boolean

  hotkeysHelpVisible = false

  mobileMsg = false
  androidAppUrl = ''
  iosAppUrl = ''

  searchHidden = false
  gameHeaderScrolled = false

  private config: ServerConfig
  private htmlConfig: HTMLServerConfig

  private quickSettingsModalSub: Subscription
  private getSearchHiddenSub: Subscription
  private hotkeysSub: Subscription
  private authSub: Subscription
  private routerEventsSub: Subscription

  /** 鼠标离开后弹窗残留上限（含淡出）：期间移回鼠标即可继续操作 */
  static readonly POPOVER_HIDE_GRACE_MS = 700

  /** 淡出过渡时长，过渡结束后才卸载 DOM */
  static readonly POPOVER_FADE_MS = 200
  /** 各弹窗「视觉开启」状态,驱动显隐 class 与 aria-expanded */
  private readonly popoverOpen = signal<Record<string, boolean>>({
    avatar: false,
    notifications: false,
    favorites: false,
    history: false,
    creator: false
  })

  /** 各弹窗是否仍挂载在 DOM 中（开启后延迟卸载以完成淡出过渡） */
  private readonly popoverMounted = signal<Record<string, boolean>>({
    avatar: false,
    notifications: false,
    favorites: false,
    history: false,
    creator: false
  })

  /** 关闭过程中的淡出态 */
  private readonly popoverClosing = signal<Record<string, boolean>>({})
  private popoverHideTimers: Record<string, {
    hide?: ReturnType<typeof setTimeout>
    unmount?: ReturnType<typeof setTimeout>
  } | undefined> = {}

  private gameCoinBalanceRequested = false
  private gameAvatarPointerDown = false
  private gameAvatarFocusOpened = false
  private gameAvatarHoverOpened = false
  private suppressGameAvatarFocus = false
  private gameAvatarRequestGeneration = 0
  private creatorOverviewRequest: ReturnType<GamesService['creatorOverview']> | undefined
  private creatorOverviewAccountKey: number | string | null = null
  private gameNavLoaded = new Set<GameHeaderPopup>()
  private gameNavRequestGenerations = new Map<GameHeaderPopup, number>()

  get requiresApproval () {
    return this.config.signup.requiresApproval
  }

  get instanceName () {
    return this.serverService.getHTMLConfig().instance.name
  }

  isInstanceNameDisplayed () {
    return this.serverService.getHTMLConfig().client.header.hideInstanceName !== true
  }

  isLoaded () {
    return this.config && (!this.loggedIn || !!this.user?.account)
  }

  isInMobileView () {
    return this.screenService.isInMobileView()
  }

  isInSmallView () {
    return this.screenService.isInSmallView()
  }

  getLogoUrl () {
    const logos = this.serverService.getHTMLConfig().instance.logo

    if (this.isInMobileView()) {
      return findAppropriateImage(logos.filter(l => l.type === 'header-square'), 36)?.fileUrl
    }

    return findAppropriateImage(logos.filter(l => l.type === 'header-wide'), 36)?.fileUrl
  }

  getGameAvatarUrl () {
    const account = this.user?.account
    const avatar = account?.avatars?.length ? findAppropriateImage(account.avatars, 64)?.fileUrl : undefined
    return avatar || buildGameAvatarDataUrl(account?.displayName || account?.name || this.user?.username || 'GameHub 玩家')
  }

  onGameAvatarError (event: Event) {
    const image = event.target as HTMLImageElement
    const label = this.user?.account?.displayName || this.user?.account?.name || this.user?.username || 'GameHub 玩家'

    if (image.src.startsWith('data:image/svg+xml')) return
    image.src = buildGameAvatarDataUrl(label)
  }

  ngOnInit () {
    this.htmlConfig = this.serverService.getHTMLConfig()

    this.loggedIn = this.authService.isLoggedIn()
    this.updateUserState()

    this.authSub = this.authService.loginChangedSource.subscribe(status => {
      if (status === AuthStatus.LoggedIn) {
        this.loggedIn = true
      } else if (status === AuthStatus.LoggedOut) {
        this.loggedIn = false
      }

      this.updateUserState()
    })

    this.hotkeysSub = this.hotkeysService.cheatSheetToggle
      .subscribe(isOpen => this.hotkeysHelpVisible = isOpen)

    this.serverService.getConfig()
      .subscribe(config => this.config = config)

    this.quickSettingsModalSub = this.modalService.openQuickSettingsSubject
      .subscribe(() => this.openQuickSettings())

    this.getSearchHiddenSub = this.headerService.getSearchHiddenObs()
      .subscribe(hidden => {
        if (hidden) document.documentElement.classList.add('global-search-hidden')
        else document.documentElement.classList.remove('global-search-hidden')

        this.searchHidden = hidden
      })

    this.setupMobileMsg()
    this.routerEventsSub = this.router.events.subscribe(event => {
      if (!(event instanceof NavigationEnd)) return

      this.updateGameHeaderScroll()
    })
    this.updateGameHeaderScroll()
  }

  ngOnDestroy () {
    this.cancelGameAvatarHover()
    for (const key of Object.keys(this.popoverHideTimers)) {
      const t = this.popoverHideTimers[key]
      if (t?.hide) clearTimeout(t.hide)
      if (t?.unmount) clearTimeout(t.unmount)
      this.popoverHideTimers[key] = undefined
    }
    if (this.quickSettingsModalSub) this.quickSettingsModalSub.unsubscribe()
    if (this.hotkeysSub) this.hotkeysSub.unsubscribe()
    if (this.authSub) this.authSub.unsubscribe()
    if (this.routerEventsSub) this.routerEventsSub.unsubscribe()
    if (this.getSearchHiddenSub) this.getSearchHiddenSub.unsubscribe()
  }

  // ---------------------------------------------------------------------------

  getDefaultRoute () {
    return this.redirectService.getDefaultRoute()
  }

  getDefaultRouteQuery () {
    return this.redirectService.getDefaultRouteQuery()
  }

  isGameExperience () {
    const path = this.router.url.split('?')[0]
    const isInternalPeerTubePage = path.startsWith('/p')

    return !isInternalPeerTubePage
  }

  // ---------------------------------------------------------------------------

  private setupMobileMsg () {
    if (this.isGameExperience()) return
    if (!this.isInMobileView()) return
    if (peertubeLocalStorage.getItem(HeaderComponent.LS_HIDE_MOBILE_MSG) === 'true') return

    if (!isAndroid() && !isIphone()) return

    const host = window.location.host
    const intentConfig = this.htmlConfig.client.openInApp.android.intent
    const iosConfig = this.htmlConfig.client.openInApp.ios

    if (isAndroid() && intentConfig.enabled === false) return
    if (isIphone() && iosConfig.enabled === false) return

    this.mobileMsg = true
    document.documentElement.classList.add('mobile-app-msg')

    const getVideoId = (url: string) => {
      const matches = url.match(/^\/w\/([^/?;]+)/)

      if (matches) return matches[1]
    }

    const getChannelId = (url: string) => {
      const matches = url.match(/^\/c\/([^/?;]+)/)

      if (matches) return matches[1]
    }

    this.router.events.subscribe(event => {
      if (!(event instanceof NavigationEnd)) return

      const url = event.url

      const baseAndroid = `intent://${intentConfig.host}`
      const fallbackAndroid = `#Intent;scheme=${intentConfig.scheme};S.browser_fallback_url=${intentConfig.fallbackUrl};end`

      const baseIOS = `peertube://${iosConfig.host}`

      const videoId = getVideoId(url)
      const channelId = getChannelId(url)

      if (videoId) {
        if (isAndroid()) {
          this.androidAppUrl = `${baseAndroid}/video/${videoId}?host=${host}${fallbackAndroid}`
        } else {
          this.iosAppUrl = `${baseIOS}/video/${videoId}?host=${host}`
        }

        return
      }

      if (channelId) {
        if (isAndroid()) {
          this.androidAppUrl = `${baseAndroid}/video-channel/${channelId}?host=${host}${fallbackAndroid}`
        } else {
          this.iosAppUrl = `${baseIOS}/video-channel/${channelId}?host=${host}`
        }

        return
      }

      if (isAndroid()) {
        this.androidAppUrl = `${baseAndroid}/?host=${host}${fallbackAndroid}`
      } else {
        this.iosAppUrl = `${baseIOS}/?host=${host}`
      }
    })
  }

  hideMobileMsg () {
    this.mobileMsg = false
    document.documentElement.classList.remove('mobile-app-msg')

    peertubeLocalStorage.setItem(HeaderComponent.LS_HIDE_MOBILE_MSG, 'true')
  }

  onOpenClientClick () {
    if (!isIOS()) return

    setTimeout(() => {
      window.location.href = this.htmlConfig.client.openInApp.ios.fallbackUrl
    }, 2500)
  }

  // ---------------------------------------------------------------------------

  isRegistrationAllowed () {
    if (!this.config) return false

    return this.config.signup.allowed &&
      this.config.signup.allowedForCurrentIP
  }

  logout (event: Event) {
    event.preventDefault()

    this.authService.logout()
    // 收起游戏态头像悬停卡,避免登出后仍展示个人信息
    this.cancelGameAvatarHover()
    // Redirect to home page
    this.redirectService.redirectToHomepage()
  }

  openQuickSettings () {
    this.quickSettingsModal().show()
  }

  openHotkeysCheatSheet () {
    this.hotkeysService.cheatSheetToggle.next(!this.hotkeysHelpVisible)
  }

  toggleMenu () {
    this.menu.toggleMenu()
  }

  @HostListener('window:scroll')
  onGameWindowScroll () {
    this.updateGameHeaderScroll()
  }

  @HostListener('window:keydown', [ '$event' ])
  onGameWindowKeydown (event: KeyboardEvent) {
    this.closeGameAvatarMenu(event)
  }

  private updateGameHeaderScroll () {
    const shouldShrink = this.isGameExperience() && window.innerWidth > 760 && window.scrollY > 150
    if (this.gameHeaderScrolled === shouldShrink) return

    this.gameHeaderScrolled = shouldShrink
    document.querySelector('.peertube-container')?.classList.toggle('game-header-scrolled', shouldShrink)
  }

  /** 弹窗状态读写 */
  isOpenPopover (key: string) {
    return this.popoverOpen()[key] === true
  }

  isPopoverMounted (key: string) {
    return this.popoverMounted()[key] === true
  }

  isPopoverClosing (key: string) {
    return this.popoverClosing()[key] === true
  }

  private setPopoverOpen (key: string, open: boolean, closeGraceMs = HeaderComponent.POPOVER_HIDE_GRACE_MS) {
    const hideTimerKey = 'hide:' + key

    if (open) {
      const pendingHide = this.popoverHideTimers[hideTimerKey]
      if (pendingHide) {
        clearTimeout(pendingHide.hide)
        if (pendingHide.unmount) clearTimeout(pendingHide.unmount)
        this.popoverHideTimers[hideTimerKey] = undefined
      }
      // 同一时间最多显示一个弹窗：打开当前时立即收起其他弹窗，不做宽限与淡出
      for (const other of Object.keys(this.popoverMounted())) {
        if (other !== key && this.isPopoverMounted(other)) this.unmountPopoverNow(other)
      }
      this.popoverMounted.update(m => ({ ...m, [key]: true }))
      this.popoverClosing.update(c => ({ ...c, [key]: false }))
      this.popoverOpen.update(o => ({ ...o, [key]: true }))
      return
    }

    this.popoverOpen.update(o => ({ ...o, [key]: false }))
    this.cancelPopoverHide(key)

    const startClosing = () => {
      this.popoverClosing.update(c => ({ ...c, [key]: true }))
      this.popoverHideTimers[hideTimerKey] = {
        unmount: setTimeout(() => {
          this.popoverMounted.update(m => ({ ...m, [key]: false }))
          this.popoverClosing.update(c => ({ ...c, [key]: false }))
          this.popoverHideTimers[hideTimerKey] = undefined
        }, HeaderComponent.POPOVER_FADE_MS)
      }
    }

    if (closeGraceMs === 0) {
      startClosing()
    } else {
      this.popoverHideTimers[hideTimerKey] = {
        hide: setTimeout(() => {
          // 宽限期内未返回:开始淡出,过渡结束后卸载
          startClosing()
        }, closeGraceMs)
      }
    }
  }
  private cancelPopoverHide (key: string) {
    const hideTimerKey = 'hide:' + key
    const timers = this.popoverHideTimers[hideTimerKey]
    if (timers) {
      clearTimeout(timers.hide)
      clearTimeout(timers.unmount)
      this.popoverHideTimers[hideTimerKey] = undefined
    }
  }

  /** 立即卸载弹窗：互斥切换时旧弹窗不做宽限与淡出 */
  private unmountPopoverNow (key: string) {
    this.cancelPopoverHide(key)
    this.popoverOpen.update(o => ({ ...o, [key]: false }))
    this.popoverMounted.update(m => ({ ...m, [key]: false }))
    this.popoverClosing.update(c => ({ ...c, [key]: false }))
  }
  scheduleGameAvatarMenu () {
    // 访客点击「登录」直达登录弹框,悬停卡仅服务已登录头像菜单
    if (this.suppressGameAvatarFocus || this.gameAvatarPointerDown || !this.isGameExperience() || !this.loggedIn) return

    if (!this.isOpenPopover('avatar')) this.gameAvatarHoverOpened = true
    this.setPopoverOpen('avatar', true)
    this.loadGameCoinBalance()
  }

  onGameAvatarFocusIn () {
    if (this.gameAvatarPointerDown || this.suppressGameAvatarFocus || !this.isGameExperience() || !this.loggedIn) return

    this.gameAvatarFocusOpened = true
    this.scheduleGameAvatarMenu()
  }

  cancelGameAvatarHover (close = true) {
    if (close) {
      this.gameAvatarHoverOpened = false
      // 头像与资料卡同步进入淡出态,避免触发器缩回后资料卡仍停留在原位
      this.setPopoverOpen('avatar', false, 0)
    }
  }

  scheduleGameNavHover (popup: GameHeaderPopup) {
    if (!this.isGameExperience()) return

    // 进入即打开,并撤销该弹窗在宽限期的关闭
    this.cancelPopoverHide(popup)
    this.setPopoverOpen(popup, true)
    this.loadGameNavData(popup)
  }

  cancelGameNavHover (popup: GameHeaderPopup, close = true) {
    if (!popup || !close) return

    // 撤「开启」态触发淡出,DOM 驻留 1 秒供鼠标移回弹窗继续操作
    this.setPopoverOpen(popup, false)
  }

  isGameNavLoading (popup: GameHeaderPopup) {
    return this.gameNavLoading()[popup]
  }

  /** 鼠标进入弹窗区域时取消关闭（配合延迟关闭使用） */
  retainGameNavHover (popup: GameHeaderPopup) {
    this.cancelPopoverHide(popup)
  }

  onGameNavFocusOut (event: FocusEvent, popup: GameHeaderPopup) {
    const container = event.currentTarget as HTMLElement | null
    const nextTarget = event.relatedTarget as Node | null

    if (container?.contains(nextTarget)) return

    this.cancelGameNavHover(popup)
  }

  onGameAvatarFocusOut (event: FocusEvent) {
    const container = event.currentTarget as HTMLElement | null
    const nextTarget = event.relatedTarget as Node | null

    if (container?.contains(nextTarget)) return

    this.gameAvatarFocusOpened = false
    this.cancelGameAvatarHover()
  }

  async copyGamePrompt (prompt: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt)
        return
      }
    } catch {
      // Fall back to the legacy clipboard path when browser permission is unavailable.
    }

    const textarea = document.createElement('textarea')
    textarea.value = prompt
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }

  getGameNavAvatarUrl (notification: GameNotification) {
    const label = notification.actor?.displayName || notification.actor?.name || notification.game?.title || '动态'
    return buildGameAvatarDataUrl(label)
  }

  getGameNavAuthorAvatarUrl (game: Game) {
    return buildGameAvatarDataUrl(game.author?.displayName || game.author?.name || 'GameHub 玩家')
  }

  getGameNavCoverUrl (game: { uuid: string; title: string; coverPath: string | null; category?: string } | null | undefined) {
    if (!game) return getGameCoverPresetUrl()
    if (game.coverPath && !this.gameNavCoverFallbacks()[game.uuid]) return game.coverPath
    if (this.gameNavPresetFallbacks()[game.uuid]) return buildGameCoverDataUrl(game.title, game.category)
    return getGameCoverPresetUrl(game.category)
  }

  /** 将 ISO 时间字符串格式化为"3小时前"风格的相对时间 */
  formatRelativeTime (isoTime: string | null | undefined): string {
    if (!isoTime) return ''
    const date = new Date(isoTime)
    if (isNaN(date.getTime())) return ''
    const diffSec = Math.max(0, (Date.now() - date.getTime()) / 1000)
    if (diffSec < 60) return '刚刚'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`
    if (diffSec < 2592000) return `${Math.floor(diffSec / 86400)}天前`
    if (diffSec < 31536000) return `${Math.floor(diffSec / 2592000)}个月前`
    return `${Math.floor(diffSec / 31536000)}年前`
  }

  onGameNavCoverError (uuid: string) {
    if (!uuid) return
    if (!this.gameNavCoverFallbacks()[uuid]) {
      this.gameNavCoverFallbacks.update(state => ({ ...state, [uuid]: true }))
      return
    }
    if (this.gameNavPresetFallbacks()[uuid]) return
    this.gameNavPresetFallbacks.update(state => ({ ...state, [uuid]: true }))
  }

  private loadGameNavData (popup: GameHeaderPopup) {
    if (this.gameNavLoaded.has(popup) || !this.loggedIn) return

    this.gameNavLoaded.add(popup)
    this.setGameNavLoading(popup, true)
    const generation = (this.gameNavRequestGenerations.get(popup) || 0) + 1
    const accountKey = this.getGameAccountKey()
    const accountGeneration = this.gameAvatarRequestGeneration
    this.gameNavRequestGenerations.set(popup, generation)
    const isCurrentRequest = () =>
      this.loggedIn &&
      this.gameNavRequestGenerations.get(popup) === generation &&
      this.gameAvatarRequestGeneration === accountGeneration &&
      this.getGameAccountKey() === accountKey

    if (popup === 'notifications') {
      this.gamesService.notifications().subscribe({
        next: value => {
          if (!isCurrentRequest()) return
          this.gameNavNotifications.set(value.data || [])
        },
        error: () => {
          if (!isCurrentRequest()) return
          this.gameNavLoaded.delete(popup)
          this.gameNavNotifications.set([])
          this.setGameNavLoading(popup, false)
        },
        complete: () => {
          if (isCurrentRequest()) this.setGameNavLoading(popup, false)
        }
      })
      return
    }

    if (popup === 'favorites') {
      this.gamesService.listFavorites().subscribe({
        next: value => {
          if (!isCurrentRequest()) return
          this.gameNavFavorites.set(value.data || [])
        },
        error: () => {
          if (!isCurrentRequest()) return
          this.gameNavLoaded.delete(popup)
          this.gameNavFavorites.set([])
          this.setGameNavLoading(popup, false)
        },
        complete: () => {
          if (isCurrentRequest()) this.setGameNavLoading(popup, false)
        }
      })
      return
    }

    if (popup === 'history') {
      this.gamesService.listRecent().subscribe({
        next: value => {
          if (!isCurrentRequest()) return
          this.gameNavRecent.set(value.data || [])
        },
        error: () => {
          if (!isCurrentRequest()) return
          this.gameNavLoaded.delete(popup)
          this.gameNavRecent.set([])
          this.setGameNavLoading(popup, false)
        },
        complete: () => {
          if (isCurrentRequest()) this.setGameNavLoading(popup, false)
        }
      })
      return
    }

    this.getCreatorOverview().subscribe({
      next: value => {
        if (!isCurrentRequest()) return
        this.gameNavOwned.set(value.games || [])
        this.gameCoinBalance.set(value.coinBalance)
        this.gameCount.set(value.gameCount)
      },
      error: () => {
        if (!isCurrentRequest()) return
        this.gameNavLoaded.delete(popup)
        this.gameNavOwned.set([])
        this.setGameNavLoading(popup, false)
      },
      complete: () => {
        if (isCurrentRequest()) this.setGameNavLoading(popup, false)
      }
    })
  }

  toggleGameAvatarMenu (event: MouseEvent) {
    event.preventDefault()
    if (!this.loggedIn || !this.isGameExperience()) return

    // 焦点预览先于 Enter/Space 产生 native click,首次键盘激活应保持弹窗打开
    if (event.detail === 0 && this.gameAvatarFocusOpened && this.isOpenPopover('avatar')) {
      this.gameAvatarFocusOpened = false
      return
    }

    // 鼠标移入头像时悬停卡已经打开,首次点击保持打开,避免点击动作反而收起预览
    if (event.detail > 0 && this.gameAvatarHoverOpened && this.isOpenPopover('avatar')) {
      this.gameAvatarHoverOpened = false
      return
    }

    this.gameAvatarFocusOpened = false
    this.gameAvatarHoverOpened = false

    if (this.isOpenPopover('avatar')) this.unmountPopoverNow('avatar')
    else this.scheduleGameAvatarMenu()
  }

  onGameAvatarPointerDown (event: PointerEvent) {
    if (event.button === 0) this.gameAvatarPointerDown = true
  }

  onGameAvatarPointerUp (event: PointerEvent) {
    if (event.button === 0 || event.type === 'pointercancel') this.gameAvatarPointerDown = false
  }

  closeGameAvatarMenu (event: KeyboardEvent) {
    if (event.key !== 'Escape' || !this.isOpenPopover('avatar')) return

    event.preventDefault()
    event.stopPropagation()
    this.gameAvatarFocusOpened = false
    this.gameAvatarHoverOpened = false
    this.suppressGameAvatarFocus = true
    this.unmountPopoverNow('avatar')
    this.gameAvatarButton()?.nativeElement.focus()
    setTimeout(() => this.suppressGameAvatarFocus = false)
  }

  openGameUpload (event: MouseEvent) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return

    event.preventDefault()
    if (this.authService.isLoggedIn()) {
      void this.router.navigate([ '/games/upload' ])
      return
    }

    // 登录成功后直接回跳投稿页,与原 /login returnUrl 行为一致
    this.authModal.openLogin({ returnUrl: '/games/upload' })
  }

  openRegisterModal () {
    this.authModal.openRegister()
  }

  openLoginModal () {
    this.authModal.openLogin({ inPlace: true })
  }

  isGameUploadRoute () {
    return this.router.url.split('?')[0] === '/games/upload'
  }

  private updateUserState () {
    const previousAccountKey = this.getGameAccountKey()
    this.user = this.loggedIn
      ? this.authService.getUser()
      : undefined
    const currentAccountKey = this.getGameAccountKey()

    if (previousAccountKey !== currentAccountKey) {
      this.gameAvatarRequestGeneration++
      this.creatorOverviewRequest = undefined
      this.creatorOverviewAccountKey = null
      this.clearGameAccountState()
    }

    if (!this.loggedIn) {
      this.clearGameAccountState()
    }
  }

  private clearGameAccountState () {
    this.gameNavRequestGenerations.clear()
    this.gameNavLoaded.clear()
    this.gameNavFavorites.set([])
    this.gameNavRecent.set([])
    this.gameNavOwned.set([])
    this.gameNavNotifications.set([])
    this.gameNavLoading.set({ notifications: false, favorites: false, history: false, creator: false })
    this.gameNavCoverFallbacks.set({})
    this.gameNavPresetFallbacks.set({})
    this.gameCoinBalance.set(null)
    this.gameCount.set(null)
    this.gameCoinBalanceRequested = false
    this.gameAvatarFocusOpened = false
    this.gameAvatarHoverOpened = false
  }

  private setGameNavLoading (popup: GameHeaderPopup, loading: boolean) {
    this.gameNavLoading.update(state => ({ ...state, [popup]: loading }))
  }

  private loadGameCoinBalance () {
    if (this.gameCoinBalanceRequested || !this.loggedIn) return

    this.gameCoinBalanceRequested = true
    const generation = this.gameAvatarRequestGeneration
    const accountKey = this.getGameAccountKey()
    const isCurrentRequest = () =>
      this.loggedIn &&
      this.gameAvatarRequestGeneration === generation &&
      this.getGameAccountKey() === accountKey

    this.getCreatorOverview().subscribe({
      next: overview => {
        if (!isCurrentRequest()) return

        this.gameCoinBalance.set(overview.coinBalance)
        this.gameCount.set(overview.gameCount)
      },
      error: () => {
        if (!isCurrentRequest()) return

        this.gameCoinBalance.set(0)
        this.gameCount.set(null)
      }
    })
  }

  private getGameAccountKey () {
    return this.user?.account?.id ?? this.user?.username ?? null
  }

  private getCreatorOverview () {
    const accountKey = this.getGameAccountKey()
    if (this.creatorOverviewRequest && this.creatorOverviewAccountKey === accountKey) return this.creatorOverviewRequest

    this.creatorOverviewAccountKey = accountKey
    this.creatorOverviewRequest = this.gamesService.creatorOverview()
      .pipe(shareReplay({ bufferSize: 1, refCount: false }))

    return this.creatorOverviewRequest
  }
}
