import { Component, OnDestroy, OnInit, inject, ChangeDetectionStrategy } from '@angular/core'
import { AuthService, ServerService } from '@app/core'
import { HorizontalMenuComponent, HorizontalMenuEntry } from '@app/shared/shared-main/menu/horizontal-menu.component'
import { Subscription } from 'rxjs'

@Component({
  selector: 'my-home-menu',
  templateUrl: './home-menu.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ HorizontalMenuComponent ]
})
export class HomeMenuComponent implements OnInit, OnDestroy {
  private server = inject(ServerService)
  private authService = inject(AuthService)

  menuEntries: HorizontalMenuEntry[] = []

  private sub: Subscription

  ngOnInit () {
    this.buildMenu()

    this.sub = this.authService.loginChangedSource
      .subscribe(() => this.buildMenu())
  }

  ngOnDestroy () {
    if (this.sub) this.sub.unsubscribe()
  }

  buildMenu () {
    const config = this.server.getHTMLConfig()
    this.menuEntries = []

    if (config.homepage.enabled) {
      this.menuEntries.push({ label: $localize`Home`, routerLink: '/games' })
    }

    this.menuEntries.push({ label: $localize`Discover games`, routerLink: '/games' })

    if (this.authService.isLoggedIn()) {
      this.menuEntries.push({ label: $localize`Following`, routerLink: '/games', queryParams: { view: 'following' } })
    }

    this.menuEntries.push({ label: $localize`Browse games`, routerLink: '/games' })
  }
}
