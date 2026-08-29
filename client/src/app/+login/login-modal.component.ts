import { NgClass } from '@angular/common'
import { AfterViewInit, Component, ElementRef, LOCALE_ID, OnInit, inject, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { FormControl, FormsModule, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
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
import { AuthCaptchaService } from './auth-captcha.service'
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
  private authCaptchaService = inject(AuthCaptchaService)
  private sanitizer = inject(DomSanitizer)

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

  // ---- 图形验证码(登录/注册共用) ----
  captchaSvg: SafeHtml = null
  captchaId = ''
  captchaAnswer = ''
  captchaLoading = false
  captchaError = false

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

    this.loadCaptcha()

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
    // 两种表单各自消费一次性验证码,切换视图即换取新验证码
    this.loadCaptcha()
  }

  loadCaptcha () {
    this.captchaLoading = true
    this.captchaError = false
    this.captchaAnswer = ''
    this.captchaId = ''

    this.authCaptchaService.getCaptcha()
      .subscribe({
        next: challenge => {
          this.captchaId = challenge.captchaId
          this.captchaSvg = this.sanitizer.bypassSecurityTrustHtml(challenge.svg)
          this.captchaLoading = false
        },

        error: () => {
          this.captchaLoading = false
          this.captchaError = true
        }
      })
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
      // 昵称选填:留空时注册请求回退为用户名
      [ 'displayName', this.regDisplayName.trim(), [ Validators.maxLength(120) ], { maxlength: $localize`昵称最多 120 个字符。` } ],
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

    if (!this.captchaId || !this.captchaAnswer.trim()) {
      this.regError = $localize`请输入图形验证码。`
      return
    }

    this.regError = null
    this.signupLoading = true

    const body = {
      username: this.regUsername.trim(),
      password: this.regPassword,
      email: this.regEmail.trim(),
      displayName: this.regDisplayName.trim() || this.regUsername.trim(),

      registrationReason: this.requiresApproval ? this.regReason : undefined,

      captchaId: this.captchaId,
      captchaToken: this.captchaAnswer.trim(),

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

        // 账户已创建。登录需一次性验证码,回到登录视图并预填凭据,
        // 用户输入新验证码后点击登录即可完成首次登录
        this.notifier.success($localize`注册成功，请输入验证码完成登录。`)
        this.switchMode('login')
        this.form.patchValue({ username: body.username, password: body.password })
      },

      error: err => {
        this.signupLoading = false
        // 验证码一次性消费:注册失败后必须换取新验证码再重试
        this.loadCaptcha()
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

    if (!this.captchaId || !this.captchaAnswer.trim()) {
      this.error = $localize`请输入图形验证码。`
      return
    }

    const options = {
      username: this.form.value['username'],
      password: this.form.value['password'],
      otpToken: this.form.value['otp-token'],
      captchaId: this.captchaId,
      captchaToken: this.captchaAnswer.trim()
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
          const message = $localize`重置邮件已发送至 ${this.forgotPasswordEmail}，链接 1 小时内有效。`

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
    // 验证码一次性消费:登录失败(含验证码错误/密码错误)后必须换取新验证码
    this.loadCaptcha()
    this.captchaAnswer = ''

    if (this.authService.isOTPMissingError(err)) {
      this.otpStep = true

      setTimeout(() => {
        this.form.get('otp-token').setValidators(USER_OTP_TOKEN_VALIDATOR.VALIDATORS)
        this.otpTokenInput().focus()
      })

      return
    }

    if (err.body?.code === ServerErrorCode.INVALID_GRANT) {
      this.error = $localize`用户名或密码错误。`
      return
    }

    if (err.body?.code === ServerErrorCode.ACCOUNT_BLOCKED) {
      this.error = $localize`您的账户已被封禁。`
      return
    }

    if (err.body?.code === ServerErrorCode.ACCOUNT_WAITING_FOR_APPROVAL) {
      this.error = $localize`该账户正在等待管理员审核。`
      return
    }

    if (err.body?.code === ServerErrorCode.ACCOUNT_APPROVAL_REJECTED) {
      this.error = $localize`该账户的注册申请已被拒绝。`
      return
    }

    if (err.body?.code === ServerErrorCode.TOO_LONG_PASSWORD) {
      this.error = $localize`当前密码过长，请重置密码。`
      this.passwordTooLongError = true
      return
    }

    if (err.body?.code === ServerErrorCode.EMAIL_NOT_VERIFIED) {
      this.emailNotVerifiedError = true
    }

    this.error = this.isChineseMessage(err.message) ? err.message : $localize`登录失败，请检查账号和密码后重试。`
  }

  private isChineseMessage (message: unknown): message is string {
    return typeof message === 'string' && /[\u4e00-\u9fff]/.test(message)
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
