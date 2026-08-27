import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { LoginModalService } from './login-modal.service'

/**
 * /login 路由壳:仅负责打开登录弹框并透传查询参数。
 * 真正的表单与登录逻辑在 LoginModalComponent 中,由 LoginModalService 打开。
 * 直接访问 /login(深链/外部回调/静态入口)时,弹框浮在画布之上;
 * 关闭弹框(非注册跳转)时兜底回首页。
 */
@Component({
  selector: 'my-login',
  template: '',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class LoginComponent implements OnInit {
  private route = inject(ActivatedRoute)
  private router = inject(Router)
  private loginModalService = inject(LoginModalService)

  ngOnInit () {
    const queryParams = this.route.snapshot.queryParams

    const ref = this.loginModalService.open({
      returnUrl: queryParams['returnUrl'],
      externalAuthToken: queryParams['externalAuthToken'],
      externalAuthUsername: queryParams['username'],
      externalAuthError: queryParams['externalAuthError'] !== undefined
    })

    ref.result
      .then(() => {})
      .catch(reason => {
        // 弹框自行跳转注册页时不再兜底跳转,避免与弹框内导航竞争
        if (reason === 'signup') return

        void this.router.navigateByUrl('/')
      })
  }
}
