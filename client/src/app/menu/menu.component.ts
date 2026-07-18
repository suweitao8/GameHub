import { CommonModule, getLocaleDirection, NgTemplateOutlet } from '@angular/common'
import { ChangeDetectionStrategy, Component, inject, LOCALE_ID, OnDestroy, OnInit } from '@angular/core'
import { Params, RouterLink, RouterLinkActive } from '@angular/router'
import { AuthService, AuthStatus, AuthUser, HooksService, MenuService, RedirectService, ServerService } from '@app/core'
import { GlobalIconComponent, GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap'
import { UserRight } from '@peertube/peertube-models'
import { Subscription } from 'rxjs'

type MenuLink = {
  icon: GlobalIconName
  iconClass?: string

  label: string

  path?: string
  url?: string
  query?: Params

  isPrimaryButton?: boolean // default false

  ngClass?: string
}

type MenuSection = {
  key: string
  title: string
  links: MenuLink[]
}

@Component({
  selector: 'my-menu',
  templateUrl: './menu.component.html',
  styleUrls: [ './menu.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    GlobalIconComponent,
    RouterLink,
    RouterLinkActive,
    NgbDropdownModule,
    NgTemplateOutlet,
    ButtonComponent
  ]
})
export class MenuComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService)
  private localeId = inject(LOCALE_ID)
  private serverService = inject(ServerService)
  private hooks = inject(HooksService)
  private menu = inject(MenuService)
  private redirectService = inject(RedirectService)

  menuSections: MenuSection[] = []
  loggedIn: boolean
  moreInfoLabel = $localize`More info`

  private user: AuthUser
  private authSub: Subscription

  get shortDescription () {
    return this.serverService.getHTMLConfig().instance.shortDescription
  }

  get instanceName () {
    return this.serverService.getHTMLConfig().instance.name
  }

  get collapsed () {
    return this.menu.isCollapsed()
  }

  get isOverlay () {
    return this.menu.isCollapsed()
  }

  ngOnInit () {
    this.loggedIn = this.authService.isLoggedIn()
    this.onUserStateChange()

    this.authSub = this.authService.loginChangedSource.subscribe(status => {
      if (status === AuthStatus.LoggedIn) this.loggedIn = true
      else if (status === AuthStatus.LoggedOut) this.loggedIn = false

      this.onUserStateChange()
    })
  }

  ngOnDestroy () {
    if (this.authSub) this.authSub.unsubscribe()
  }

  // ---------------------------------------------------------------------------

  toggleMenu () {
    this.menu.toggleMenu()
  }

  // ---------------------------------------------------------------------------

  private async buildMenuSections () {
    this.menuSections = []

    for (const section of [ this.buildQuickLinks(), this.buildLibraryLinks(), this.buildVideoMakerLinks(), this.buildAdminLinks() ]) {
      if (section.links.length !== 0) {
        this.menuSections.push(section)
      }
    }

    this.menuSections = await this.hooks.wrapObject(this.menuSections, 'common', 'filter:left-menu.links.create.result')
  }

  private buildQuickLinks (): MenuSection {
    const base: MenuSection = {
      key: 'quick-access',
      title: $localize`Quick access`,
      links: [
        {
          path: this.redirectService.getDefaultRoute(),
          query: this.redirectService.getDefaultRouteQuery(),
          icon: 'home',
          label: $localize`Home`
        }
      ]
    }

    return base
  }

  private buildLibraryLinks (): MenuSection {
    return {
      key: 'my-library',
      title: $localize`My library`,
      links: []
    }
  }

  private buildVideoMakerLinks (): MenuSection {
    return {
      key: 'my-video-space',
      title: $localize`My video space`,
      links: []
    }
  }

  private buildAdminLinks (): MenuSection {
    const links: MenuLink[] = []

    if (this.loggedIn) {
      if (this.user.hasRight(UserRight.SEE_ALL_VIDEOS)) {
        links.push({
          path: '/admin/overview',
          icon: 'overview',
          label: $localize`Overview`
        })
      }

      if (this.user.hasRight(UserRight.MANAGE_ABUSES)) {
        links.push({
          path: '/admin/moderation',
          icon: 'moderation',
          label: $localize`Moderation`
        })
      }

      if (this.user.hasRight(UserRight.MANAGE_CONFIGURATION)) {
        links.push({
          path: '/admin/settings',
          icon: 'config',
          label: $localize`Settings`
        })
      }
    }

    return {
      key: 'admin',
      title: $localize`Administration`,
      links
    }
  }

  // ---------------------------------------------------------------------------

  private onUserStateChange () {
    this.user = this.loggedIn
      ? this.authService.getUser()
      : undefined

    this.buildMenuSections()
  }

  isRTL () {
    return getLocaleDirection(this.localeId) === 'rtl'
  }
}
