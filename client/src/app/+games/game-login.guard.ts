import { Injectable, inject } from '@angular/core'
import { CanActivate, Router, RouterStateSnapshot } from '@angular/router'
import { AuthService } from '@app/core/auth/auth.service'

@Injectable({ providedIn: 'root' })
export class GameLoginGuard implements CanActivate {
  private readonly authService = inject(AuthService)
  private readonly router = inject(Router)

  canActivate (_route: unknown, state: RouterStateSnapshot) {
    if (this.authService.isLoggedIn()) return true

    return this.router.createUrlTree([ '/login' ], {
      queryParams: { returnUrl: state.url }
    })
  }
}
