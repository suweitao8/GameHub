import { Injectable, inject } from '@angular/core'
import { AuthModalService, LoginModalOptions } from './auth-modal.service'

/**
 * 登录弹框打开入口(守卫/头部/游戏域使用)。
 * 实际打开逻辑统一在 AuthModalService,以便登录/注册弹框互相叠加。
 */
@Injectable({ providedIn: 'root' })
export class LoginModalService {
  private authModal = inject(AuthModalService)

  open (options: LoginModalOptions = {}) {
    return this.authModal.openLogin(options)
  }
}

export type { LoginModalOptions }
