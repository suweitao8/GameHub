import { Injectable, inject } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { LoginModalComponent } from './login-modal.component'

export interface LoginModalOptions {
  /** 登录成功后的回跳地址(路由壳/守卫透传) */
  returnUrl?: string
  /** 外部登录回调参数(服务端重定向回 /login 时由路由壳透传) */
  externalAuthToken?: string
  externalAuthUsername?: string
  externalAuthError?: boolean
  /** 在当前页原位打开:登录成功后仅关闭弹框,不触发跳转 */
  inPlace?: boolean
  /** 打开即为单步创建账户视图(/signup 深链、头部创建账户) */
  mode?: 'login' | 'register'
}

/**
 * 登录/注册弹框统一入口。
 * 登录与注册是同一弹框的两个视图(mode),在界面内切换,不再叠加新弹框。
 */
@Injectable({ providedIn: 'root' })
export class AuthModalService {
  private ngbModal = inject(NgbModal)

  open (options: LoginModalOptions & { mode?: 'login' | 'register' } = {}) {
    const { mode, ...loginOptions } = options

    const ref = this.ngbModal.open(LoginModalComponent, {
      backdrop: 'static',
      centered: true,
      windowClass: 'game-auth-modal'
    })

    Object.assign(ref.componentInstance, loginOptions, { mode: mode ?? 'login' })

    return ref
  }

  /** 兼容旧调用名:以注册视图打开 */
  openLogin (options: LoginModalOptions = {}) {
    return this.open(options)
  }

  openRegister () {
    return this.open({ mode: 'register' })
  }
}
