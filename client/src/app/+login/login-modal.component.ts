import { NgClass } from '@angular/common'
import { AfterViewInit, Component, ElementRef, LOCALE_ID, OnInit, inject, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { AuthService, Notifier, RedirectService, ServerService, SessionStorageService, UserService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { LOGIN_PASSWORD_VALIDATOR, LOGIN_USERNAME_VALIDATOR } from '@app/shared/form-validators/login-validators'
import { USER_OTP_TOKEN_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { InputTextComponent } from '@app/shared/shared-forms/input-text.component'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { NgbActiveModal, NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { getCompleteLocale, getExternalAuthHref } from '@peertube/peertube-core-utils'
import { RegisteredExternalAuthConfig, ServerConfig, ServerErrorCode } from '@peertube/peertube-models'
import { of, switchMap } from 'rxjs'
import { environment } from '../../environments/environment'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { AutofocusDirective } from '../shared/shared-main/common/autofocus.directive'
import { PluginSelectorDirective } from '../shared/shared-main/plugins/plugin-selector.directive'

/**
 * 登录弹框:由 LoginModalService 以 NgbModal 打开,不再绑定 /login 路由。
 * 通过实例属性注入上下文(由打开方赋值):
 * - inPlace: 在当前页原位打开(头部/守卫等),登录成功后仅关闭弹框,不触发跳转
 * - returnUrl/externalAuth*: 路由壳或守卫透传的回调参数
 */
@Component({
  selector: 'my-login-modal',
  templateUrl: './login-modal.component.html',
  styleUrls: [ './login-modal.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    RouterLink,
    FormsModule,
    PluginSelectorDirective,
    ReactiveFormsModule,
    AutofocusDirective,
    NgClass,
    InputTextComponent,
    GlobalIconComponent,
    AlertComponent
  ]
})
export class LoginModalComponent extends FormReactive implements OnInit, AfterViewInit {
  protected formReactiveService = inject(FormReactiveService)
  private modalService = inject(NgbModal)
  private activeModal = inject(NgbActiveModal)
  private authService = inject(AuthService)
  private userService = inject(UserService)
  private redirectService = inject(RedirectService)
  private notifier = inject(Notifier)
  private hooks = inject(HooksService)
  private storage = inject(SessionStorageService)
  private router = inject(Router)
  private serverService = inject(ServerService)
  private localeId = inject(LOCALE_ID)

  private static SESSION_STORAGE_REDIRECT_URL_KEY = 'login-previous-url'

  returnUrl: string = null
  externalAuthToken: string = null
  externalAuthUsername: string = null
  externalAuthError = false
  inPlace = false

  readonly forgotPasswordModal = viewChild<ElementRef>('forgotPasswordModal')
  readonly otpTokenInput = viewChild<InputTextComponent>('otpTokenInput')
  error: string = null
  emailNotVerifiedError = false
  passwordTooLongError = false

  forgotPasswordEmail = ''

  isAuthenticatedWithExternalAuth = false
  externalLogins: string[] = []

  otpStep = false

  serverConfig: ServerConfig

  private openedForgotPasswordModal: NgbModalRef

  get signupAllowed () {
    return this.serverConfig?.signup.allowed === true
  }

  isEmailDisabled () {
    return this.serverConfig?.email.enabled === false
  }

  ngOnInit () {
    // Avoid undefined errors when accessing form error properties
    this.buildForm({
      'username': LOGIN_USERNAME_VALIDATOR,
      'password': LOGIN_PASSWORD_VALIDATOR,
      'otp-token': {
        VALIDATORS: [], // Will be set dynamically
        MESSAGES: USER_OTP_TOKEN_VALIDATOR.MESSAGES
      }
    })

    this.serverService.getConfig().subscribe(config => {
      this.serverConfig = config

      if (this.externalAuthToken) {
        this.loadExternalAuthToken(this.externalAuthUsername, this.externalAuthToken)
        return
      }

      const previousUrl = this.returnUrl || this.redirectService.getPreviousUrl()
      if (previousUrl && previousUrl !== '/') {
        this.storage.setItem(LoginModalComponent.SESSION_STORAGE_REDIRECT_URL_KEY, previousUrl)
      }
    })
  }

  ngAfterViewInit () {
    this.hooks.runAction('action:login.init', 'login')
  }

  dismiss () {
    this.activeModal.dismiss('cross')
  }

  goSignup () {
    this.activeModal.dismiss('signup')
    void this.router.navigateByUrl('/signup')
  }

  getExternalLogins () {
    return this.serverConfig.plugin.registeredExternalAuths
  }

  hasExternalLogins () {
    return this.getExternalLogins().length !== 0
  }

  getAuthHref (auth: RegisteredExternalAuthConfig) {
    return getExternalAuthHref(environment.apiUrl, auth)
  }

  login () {
    this.error = null
    this.emailNotVerifiedError = false
    this.passwordTooLongError = false

    const options = {
      username: this.form.value['username'],
      password: this.form.value['password'],
      otpToken: this.form.value['otp-token']
    }

    this.authService.login(options)
      .pipe(
        switchMap(() => this.authService.userInformationLoaded),
        switchMap(() => this.updateUserLanguageIfNeeded())
      )
      .subscribe({
        next: () => {
          // 原位打开(头部/守卫):留在当前页,关闭弹框即可,后续动作按已登录态重新执行
          if (this.inPlace) {
            this.activeModal.close()
            return
          }

          const redirectUrl = this.storage.getItem(LoginModalComponent.SESSION_STORAGE_REDIRECT_URL_KEY)
          this.storage.removeItem(LoginModalComponent.SESSION_STORAGE_REDIRECT_URL_KEY)

          this.activeModal.close()

          if (redirectUrl) {
            return this.router.navigateByUrl(redirectUrl)
          }

          return this.redirectService.redirectToPreviousRoute({ reloadTab: this.shouldReloadTabOnLogin() })
        },

        error: err => {
          this.handleError(err)
        }
      })
  }

  askResetPassword () {
    this.userService.askResetPassword(this.forgotPasswordEmail)
      .subscribe({
        next: () => {
          const message = $localize`An email with the reset password instructions will be sent to ${this.forgotPasswordEmail}.
The link will expire within 1 hour.`

          this.notifier.success(message)
          this.hideForgotPasswordModal()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  openForgotPasswordModal () {
    this.openedForgotPasswordModal = this.modalService.open(this.forgotPasswordModal())
  }

  hideForgotPasswordModal () {
    this.openedForgotPasswordModal.close()
  }

  private loadExternalAuthToken (username: string, token: string) {
    this.isAuthenticatedWithExternalAuth = true

    this.authService.login({ username, password: null, token })
      .pipe(
        switchMap(() => this.authService.userInformationLoaded),
        switchMap(() => this.updateUserLanguageIfNeeded())
      )
      .subscribe({
        next: () => {
          if (this.inPlace) {
            this.activeModal.close()
            return
          }

          const redirectUrl = this.storage.getItem(LoginModalComponent.SESSION_STORAGE_REDIRECT_URL_KEY)
          this.storage.removeItem(LoginModalComponent.SESSION_STORAGE_REDIRECT_URL_KEY)

          this.activeModal.close()

          if (redirectUrl) {
            return this.router.navigateByUrl(redirectUrl)
          }

          this.redirectService.redirectToLatestSessionRoute({ reloadTab: this.shouldReloadTabOnLogin() })
        },

        error: err => {
          this.handleError(err)
          this.isAuthenticatedWithExternalAuth = false
        }
      })
  }

  private handleError (err: any) {
    if (this.authService.isOTPMissingError(err)) {
      this.otpStep = true

      setTimeout(() => {
        this.form.get('otp-token').setValidators(USER_OTP_TOKEN_VALIDATOR.VALIDATORS)
        this.otpTokenInput().focus()
      })

      return
    }

    if (err.body?.code === ServerErrorCode.INVALID_GRANT) {
      this.error = $localize`Incorrect username or password.`
      return
    }

    if (err.body?.code === ServerErrorCode.ACCOUNT_BLOCKED) {
      this.error = $localize`Your account is blocked.`
      return
    }

    if (err.body?.code === ServerErrorCode.ACCOUNT_WAITING_FOR_APPROVAL) {
      this.error = $localize`This account is awaiting approval by moderators.`
      return
    }

    if (err.body?.code === ServerErrorCode.ACCOUNT_APPROVAL_REJECTED) {
      this.error = $localize`Registration approval has been rejected for this account.`
      return
    }

    if (err.body?.code === ServerErrorCode.TOO_LONG_PASSWORD) {
      this.error = $localize`Your current password is too long. Please reset it.`
      this.passwordTooLongError = true
      return
    }

    if (err.body?.code === ServerErrorCode.EMAIL_NOT_VERIFIED) {
      this.emailNotVerifiedError = true
    }

    this.error = err.message
  }

  private shouldReloadTabOnLogin () {
    const user = this.authService.getUser()

    return user.language && getCompleteLocale(user.language) !== getCompleteLocale(this.localeId)
  }

  private updateUserLanguageIfNeeded () {
    if (this.authService.getUser().language) {
      return this.userService.updateInterfaceLanguage(this.authService.getUser().language)
    }

    return of(true)
  }
}
