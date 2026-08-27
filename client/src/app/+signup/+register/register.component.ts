import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core'
import { Router } from '@angular/router'
import { AuthModalService } from '@app/+login/auth-modal.service'

/**
 * /signup 路由壳:仅负责打开注册弹框并保持旧地址可用。
 * 真正的注册向导在 RegisterModalComponent 中,由 AuthModalService 打开。
 * 直接访问 /signup(深链/旧链接)时,弹框浮在画布之上;关闭弹框时兜底回首页。
 */
@Component({
  selector: 'my-register',
  template: '',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class RegisterComponent implements OnInit {
  private router = inject(Router)
  private authModal = inject(AuthModalService)

  ngOnInit () {
    const ref = this.authModal.openRegister()

    ref.result
      .then(() => {})
      .catch(() => {
        // 关闭弹框或注册完成(已自动登录)后,都回首页离开注册路由
        void this.router.navigateByUrl('/')
      })
  }
}
