import { Injectable, inject } from '@angular/core'
import { CanActivate, RouterStateSnapshot } from '@angular/router'
import { AuthService } from '@app/core/auth/auth.service'
import { LoginModalService } from '@app/+login/login-modal.service'

@Injectable({ providedIn: 'root' })
export class GameLoginGuard implements CanActivate {
  private readonly authService = inject(AuthService)
  private readonly loginModalService = inject(LoginModalService)

  canActivate (_route: unknown, state: RouterStateSnapshot) {
    if (this.authService.isLoggedIn()) return true

    // 访客原位弹出登录弹框,保留目标地址;登录成功后由弹框回跳该地址
    this.loginModalService.open({ returnUrl: state.url })

    return false
  }
}
