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
}

@Injectable({ providedIn: 'root' })
export class LoginModalService {
  private ngbModal = inject(NgbModal)

  open (options: LoginModalOptions = {}) {
    const ref = this.ngbModal.open(LoginModalComponent, {
      backdrop: 'static',
      centered: true,
      windowClass: 'game-auth-modal'
    })

    Object.assign(ref.componentInstance, options)

    return ref
  }
}
