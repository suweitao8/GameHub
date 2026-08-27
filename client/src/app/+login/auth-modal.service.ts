import { Injectable, inject } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { LoginModalComponent } from './login-modal.component'
import { RegisterModalComponent } from '@app/+signup/+register/register-modal.component'

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

/**
 * 登录/注册弹框统一入口。
 * 两个弹框可以互相叠加打开(注册页点「直接登录」、登录页点「创建账户」),
 * 因此由同一个服务持有打开逻辑,避免组件与彼此的服务形成循环依赖。
 */
@Injectable({ providedIn: 'root' })
export class AuthModalService {
  private ngbModal = inject(NgbModal)

  openLogin (options: LoginModalOptions = {}) {
    const ref = this.ngbModal.open(LoginModalComponent, {
      backdrop: 'static',
      centered: true,
      windowClass: 'game-auth-modal'
    })

    Object.assign(ref.componentInstance, options)

    return ref
  }

  openRegister () {
    return this.ngbModal.open(RegisterModalComponent, {
      backdrop: 'static',
      centered: true,
      windowClass: 'game-auth-modal game-register-modal'
    })
  }
}
