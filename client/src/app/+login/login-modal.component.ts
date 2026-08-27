import { NgClass } from '@angular/common'
import { AfterViewInit, Component, ElementRef, LOCALE_ID, OnInit, inject, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { FormControl, FormsModule, ReactiveFormsModule, ValidatorFn } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { AuthService, Notifier, RedirectService, ServerService, SessionStorageService, UserService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { LOGIN_PASSWORD_VALIDATOR, LOGIN_USERNAME_VALIDATOR } from '@app/shared/form-validators/login-validators'
import { REQUIRED_EMAIL_VALIDATOR } from '@app/shared/form-validators/common-validators'
import { USER_OTP_TOKEN_VALIDATOR, getUserNewPasswordValidator } from '@app/shared/form-validators/user-validators'
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
import { SignupService } from '../+signup/shared/signup.service'

/**
 * 登录/注册弹框(同一界面双模式):
 * - mode 'login':登录表单(默认)
 * - mode 'register':单步创建账户(用户名/密码/确认密码/邮箱),不再有旧的多步向导
 * 由 AuthModalService 以 NgbModal 打开;打开方可通过实例属性注入:
 * - mode: 直接以注册模式打开(/signup 深链、头部创建账户)
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
  private signupService = inject(SignupService)

  private static SESSION_STORAGE_REDIRECT_URL_KEY = 'login-previous-url'

  mode: 'login' | 'register' = 'login'
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

  // ---- 注册模式(单步)状态 ----
  regUsername = ''
  regDisplayName = ''
  regPassword = ''
  regConfirmPassword = ''
  regEmail = ''
  regReason = ''
  regErrors: Record<string, string> = {}
  regError: string = null
  signupLoading = false

  serverConfig: ServerConfig

  private openedForgotPasswordModal: NgbModalRef

  get signupAllowed () {
    return this.serverConfig?.signup.allowed === true
  }

  get requiresApproval () {
    return this.serverConfig?.signup.requiresApproval === true
  }

  get requiresEmailVerification () {
    return this.serverConfig?.signup.requiresEmailVerification === true
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
    // 同一界面内切换到单步创建账户视图,不再叠加/新开弹框
    this.switchMode('register')
  }

  switchMode (mode: 'login' | 'register') {
    this.mode = mode
    this.error = null
    this.regError = null
    this.regErrors = {}
    this.signupLoading = false
    this.otpStep = false
  }

  private firstValidatorError (value: string, validators: ValidatorFn[], messages: Record<string, string>) {
    const control = new FormControl(value, validators)
    const errors = control.errors
    if (!errors) return null

    for (const key of Object.keys(errors)) {
      if (messages[key]) return messages[key]
    }

    return Object.values(errors)[0] as string
  }

  validateRegisterForm () {
    const passwordConstraints = this.serverService.getHTMLConfig().fieldsConstraints.users.password
    const passwordValidator = getUserNewPasswordValidator(passwordConstraints.minLength, passwordConstraints.maxLength)

    const regValidators: [string, string, ValidatorFn[], Record<string, string>][] = [
      [ 'username', this.regUsername.trim(), LOGIN_USERNAME_VALIDATOR.VALIDATORS, LOGIN_USERNAME_VALIDATOR.MESSAGES ],
      [ 'email', this.regEmail.trim(), REQUIRED_EMAIL_VALIDATOR.VALIDATORS, REQUIRED_EMAIL_VALIDATOR.MESSAGES ],
      [ 'password', this.regPassword, passwordValidator.VALIDATORS, passwordValidator.MESSAGES ]
    ]

    const errors: Record<string, string | null> = {}
    for (const [ key, value, validators, messages ] of regValidators) {
      errors[key] = this.firstValidatorError(value, validators, messages)
    }

    errors['confirmPassword'] = this.regPassword === this.regConfirmPassword
      ? null
      : $localize`两次输入的密码不一致。`

    this.regErrors = errors
  }

  registerAccount () {
    if (!this.serverConfig || this.signupLoading) return

    this.validateRegisterForm()
    if (Object.values(this.regErrors).some(Boolean)) return

    this.regError = null
    this.signupLoading = true

    const body = {
      username: this.regUsername.trim(),
      password: this.regPassword,
      email: this.regEmail.trim(),
      displayName: this.regDisplayName.trim() || this.regUsername.trim(),

      registrationReason: this.requiresApproval ? this.regReason : undefined,

      channel: undefined as { name: string, displayName: string } | undefined
    }

    const obs = this.requiresApproval
      ? this.signupService.requestSignup(body)
      : this.signupService.signup(body)

    obs.subscribe({
      next: () => {
        this.signupLoading = false

        if (this.requiresApproval || this.requiresEmailVerification) {
          this.notifier.success($localize`注册申请已提交，请按页面提示完成后续步骤。`)
          this.closeAfterDone()
          return
        }

        // 注册即登录(与旧逻辑一致),成功后关闭全部弹框
        this.authService.login({ username: body.username, password: body.password })
          .pipe(switchMap(() => this.authService.userInformationLoaded))
          .subscribe({
            next: () => {
              this.notifier.success($localize`注册成功，欢迎加入 GameHub！`)
              this.closeAfterDone()
            },

            error: err => {
              this.signupLoading = false
              // 账户已创建,仅自动登录失败:回到登录视图并保留原因提示
              this.switchMode('login')
              this.notifier.success($localize`注册成功，请使用新账户登录。`)
              if (err) {
                this.error = err.message || null
                this.mode = 'register'
              }
            }
          })
      },

      error: err => {
        this.signupLoading = false
        this.regError = err.body?.detail || err.message
      }
    })
  }

  private closeAfterDone () {
    // 关闭全部弹框(含叠加场景),登录态/提示已就绪
    this.modalService.dismissAll('auth-done')
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
