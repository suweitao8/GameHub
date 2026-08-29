import { CommonModule, getLocaleDirection, NgTemplateOutlet } from '@angular/common'
import { ChangeDetectionStrategy, Component, inject, LOCALE_ID, OnDestroy, OnInit } from '@angular/core'
import { Params, RouterLink, RouterLinkActive } from '@angular/router'
import { AuthService, AuthStatus, HooksService, MenuService, ServerService } from '@app/core'
import { GlobalIconComponent, GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { ButtonComponent } from '@app/shared/shared-main/buttons/button.component'
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap'
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

  menuSections: MenuSection[] = []
  loggedIn: boolean
  moreInfoLabel = $localize`更多信息`

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

    for (const section of [ this.buildQuickLinks(), this.buildPlayLinks(), this.buildCreateLinks() ]) {
      if (section.links.length !== 0) {
        this.menuSections.push(section)
      }
    }

    this.menuSections = await this.hooks.wrapObject(this.menuSections, 'common', 'filter:left-menu.links.create.result')
  }

  private buildQuickLinks (): MenuSection {
    return {
      key: 'quick-access',
      title: $localize`发现`,
      links: [
        {
          path: '/games',
          icon: 'home',
          label: $localize`发现游戏`
        },
        {
          path: '/games/community',
          icon: 'users',
          label: $localize`社区`
        },
        {
          path: '/games/rankings',
          icon: 'history',
          label: $localize`排行榜`
        },
        {
          path: '/about',
          icon: 'help',
          label: $localize`关于 GameHub`
        }
      ]
    }
  }

  private buildPlayLinks (): MenuSection {
    if (!this.loggedIn) {
      return { key: 'play', title: $localize`我的游戏`, links: [] }
    }

    return {
      key: 'play',
      title: $localize`我的游戏`,
      links: [
        {
          path: '/games/library',
          query: { tab: 'favorites' },
          icon: 'star',
          label: $localize`收藏`
        },
        {
          path: '/games/library',
          query: { tab: 'recent' },
          icon: 'history',
          label: $localize`游玩历史`
        },
        {
          path: '/games/notifications',
          icon: 'bell',
          label: $localize`消息`
        },
        {
          path: '/my-account',
          icon: 'user',
          label: $localize`个人中心`
        }
      ]
    }
  }

  private buildCreateLinks (): MenuSection {
    if (!this.loggedIn) {
      return { key: 'create', title: $localize`创作`, links: [] }
    }

    return {
      key: 'create',
      title: $localize`创作`,
      links: [
        {
          path: '/games/upload',
          icon: 'upload',
          label: $localize`投稿游戏`,
          isPrimaryButton: true
        },
        {
          path: '/games/creator',
          icon: 'playlists',
          label: $localize`创作中心`
        }
      ]
    }
  }

  // ---------------------------------------------------------------------------

  private onUserStateChange () {
    this.buildMenuSections()
  }

  isRTL () {
    return getLocaleDirection(this.localeId) === 'rtl'
  }
}
