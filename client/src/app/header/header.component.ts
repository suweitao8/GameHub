import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core'
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router'
import { AuthService, AuthStatus, AuthUser, HotkeysService, MenuService, RedirectService, ScreenService, ServerService } from '@app/core'
import { NotificationDropdownComponent } from '@app/header/notification-dropdown.component'
import { QuickSettingsModalComponent } from '@app/menu/quick-settings-modal.component'
import { ActorAvatarComponent } from '@app/shared/shared-actor-image/actor-avatar.component'
import { PeertubeModalService } from '@app/shared/shared-main/peertube-modal/peertube-modal.service'
import { LoginLinkComponent } from '@app/shared/shared-main/users/login-link.component'
import { SignupLabelComponent } from '@app/shared/shared-main/users/signup-label.component'
import { NgbDropdown, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap'
import { findAppropriateImage } from '@peertube/peertube-core-utils'
import { HTMLServerConfig, ServerConfig } from '@peertube/peertube-models'
import { peertubeLocalStorage } from '@root-helpers/peertube-web-storage'
import { isAndroid, isIOS, isIphone } from '@root-helpers/web-browser'
import { Subscription } from 'rxjs'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { ButtonComponent } from '../shared/shared-main/buttons/button.component'
import { buildGameAvatarDataUrl } from '../shared/game-avatar'
import { HeaderService } from './header.service'
import { GameNavigationComponent } from './game-navigation.component'
import { GameNotificationBadgeService } from './game-notification-badge.service'
import { SearchTypeaheadComponent } from './search-typeahead.component'

@Component({
  selector: 'my-header',
  templateUrl: './header.component.html',
  styleUrls: [ './header.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    NotificationDropdownComponent,
    ActorAvatarComponent,
    SignupLabelComponent,
    LoginLinkComponent,
    QuickSettingsModalComponent,
    GlobalIconComponent,
    RouterLink,
    NgbDropdownModule,
    SearchTypeaheadComponent,
    RouterLink,
    RouterLinkActive,
    GlobalIconComponent,
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
  readonly gameNotificationBadge = inject(GameNotificationBadgeService)

  private static LS_HIDE_MOBILE_MSG = 'hide-mobile-msg'

  readonly quickSettingsModal = viewChild<QuickSettingsModalComponent>('quickSettingsModal')
  readonly dropdown = viewChild<NgbDropdown>('dropdown')
  readonly gameAvatarHoverVisible = signal(false)

  user: AuthUser
  loggedIn: boolean

  hotkeysHelpVisible = false

  mobileMsg = false
  androidAppUrl = ''
  iosAppUrl = ''

  searchHidden = false

  private config: ServerConfig
  private htmlConfig: HTMLServerConfig

  private quickSettingsModalSub: Subscription
  private getSearchHiddenSub: Subscription
  private hotkeysSub: Subscription
  private authSub: Subscription
  private gameAvatarHoverTimer: ReturnType<typeof setTimeout> | undefined

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
    return avatar || buildGameAvatarDataUrl(account?.displayName || account?.name || this.user?.username || '用户')
  }

  onGameAvatarError (event: Event) {
    const image = event.target as HTMLImageElement
    const label = this.user?.account?.displayName || this.user?.account?.name || this.user?.username || '用户'

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
  }

  ngOnDestroy () {
    this.cancelGameAvatarHover()
    if (this.quickSettingsModalSub) this.quickSettingsModalSub.unsubscribe()
    if (this.hotkeysSub) this.hotkeysSub.unsubscribe()
    if (this.authSub) this.authSub.unsubscribe()
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

  scheduleGameAvatarMenu () {
    if (!this.isGameExperience() || !this.loggedIn) return

    this.cancelGameAvatarHover(false)
    this.gameAvatarHoverTimer = setTimeout(() => this.gameAvatarHoverVisible.set(true), 1000)
  }

  cancelGameAvatarHover (close = true) {
    if (this.gameAvatarHoverTimer) {
      clearTimeout(this.gameAvatarHoverTimer)
      this.gameAvatarHoverTimer = undefined
    }

    if (close) this.gameAvatarHoverVisible.set(false)
  }

  openGameProfile (event: Event) {
    event.preventDefault()
    this.cancelGameAvatarHover()
    const accountId = this.user?.account?.id
    void this.router.navigate(accountId ? [ '/games/author', accountId ] : [ '/games' ])
  }

  private updateUserState () {
    this.user = this.loggedIn
      ? this.authService.getUser()
      : undefined
  }
}
