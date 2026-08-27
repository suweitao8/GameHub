import { CdkStep, CdkStepperNext, CdkStepperPrevious } from '@angular/cdk/stepper'
import { Component, OnInit, inject, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { AuthService, ServerService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import {
  UserRegistrationState,
  PeerTubeProblemDocument,
  ServerConfig,
  UserRegister,
  UserRegistration
} from '@peertube/peertube-models'
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { AuthModalService } from '@app/+login/auth-modal.service'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { LoaderComponent } from '../../shared/shared-main/common/loader.component'
import { SignupLabelComponent } from '../../shared/shared-main/users/signup-label.component'
import { SignupSuccessBeforeEmailComponent } from '../shared/signup-success-before-email.component'
import { SignupService } from '../shared/signup.service'
import { RegisterStepperComponent } from './register-stepper.component'
import { RegisterStepChannelComponent } from './steps/register-step-channel.component'
import { RegisterStepTermsComponent } from './steps/register-step-terms.component'
import { RegisterStepUserComponent } from './steps/register-step-user.component'

/**
 * 注册弹框:由 RegisterModalService 以 NgbModal 打开,可叠加在登录弹框之上。
 * 复用注册向导的 terms/user/channel 步骤组件,去掉旧的 About 营销步骤与吉祥物标题,
 * 视觉对齐「靛蓝霓虹·轻画布」设计系统。
 * 注册成功并自动登录后关闭全部弹框。
 */
@Component({
  selector: 'my-register-modal',
  templateUrl: './register-modal.component.html',
  styleUrls: [ './register-modal.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    RegisterStepperComponent,
    CdkStep,
    RegisterStepTermsComponent,
    CdkStepperPrevious,
    CdkStepperNext,
    RegisterStepUserComponent,
    RegisterStepChannelComponent,
    SignupLabelComponent,
    LoaderComponent,
    SignupSuccessBeforeEmailComponent,
    AlertComponent,
    GlobalIconComponent
  ]
})
export class RegisterModalComponent implements OnInit {
  private activeModal = inject(NgbActiveModal)
  private ngbModal = inject(NgbModal)
  private authModal = inject(AuthModalService)
  private authService = inject(AuthService)
  private signupService = inject(SignupService)
  private server = inject(ServerService)
  private hooks = inject(HooksService)

  readonly lastStep = viewChild<CdkStep>('lastStep')
  signupError: string
  signupSuccess = false

  videoUploadDisabled: boolean
  videoQuota: number

  formStepTerms: FormGroup
  formStepUser: FormGroup
  formStepChannel: FormGroup

  signupDisabled = false
  ready = false

  private serverConfig: ServerConfig
  private _requiresApproval: boolean

  get requiresEmailVerification () {
    return this.serverConfig.signup.requiresEmailVerification
  }

  get requiresApproval () {
    return this._requiresApproval ?? this.serverConfig.signup.requiresApproval
  }

  set requiresApproval (value: boolean) {
    this._requiresApproval = value
  }

  get minimumAge () {
    return this.serverConfig.signup.minimumAge
  }

  get instanceName () {
    return this.serverConfig.instance.name
  }

  ngOnInit () {
    this.server.getConfig().subscribe(config => {
      this.serverConfig = config

      if (this.serverConfig.signup.allowed === false || this.serverConfig.signup.allowedForCurrentIP === false) {
        this.signupDisabled = true
      } else {
        this.videoQuota = this.serverConfig.user.videoQuota
        this.videoUploadDisabled = this.videoQuota === 0

        this.hooks.runAction('action:signup.register.init', 'signup')
      }

      this.ready = true
    })
  }

  dismiss () {
    this.activeModal.dismiss('cross')
  }

  openLogin () {
    // 登录弹框叠加在本弹框之上,关闭后回到注册进度
    this.authModal.openLogin()
  }

  hasSameChannelAndAccountNames () {
    return this.getUsername() === this.getChannelName()
  }

  getUsername () {
    if (!this.formStepUser) return undefined

    return this.formStepUser.value['username']
  }

  getChannelName () {
    if (!this.formStepChannel) return undefined

    return this.formStepChannel.value['name']
  }

  onTermsFormBuilt (form: FormGroup) {
    this.formStepTerms = form
  }

  onUserFormBuilt (form: FormGroup) {
    this.formStepUser = form
  }

  onChannelFormBuilt (form: FormGroup) {
    this.formStepChannel = form
  }

  skipChannelCreation () {
    this.formStepChannel.reset()
    this.lastStep().select()

    this.signup()
  }

  async signup () {
    this.signupError = undefined

    const termsForm = this.formStepTerms.value
    const userForm = this.formStepUser.value
    const channelForm = this.formStepChannel?.value

    const channel = this.formStepChannel?.value?.name
      ? { name: channelForm?.name, displayName: channelForm?.displayName }
      : undefined

    const body = await this.hooks.wrapObject(
      {
        username: userForm.username,
        password: userForm.password,
        email: userForm.email,
        displayName: userForm.displayName,

        registrationReason: termsForm.registrationReason,

        channel
      },
      'signup',
      'filter:api.signup.registration.create.params'
    )

    const obs = this.requiresApproval
      ? this.signupService.requestSignup(body)
      : this.signupService.signup(body)

    obs.subscribe({
      next: (registration) => {
        if ('state' in registration) {
          const { state } = registration as UserRegistration
          this.requiresApproval = state.id === UserRegistrationState.PENDING
        }

        if (this.requiresEmailVerification || this.requiresApproval) {
          this.signupSuccess = true
          return
        }

        // Auto login
        this.autoLogin(body)
      },

      error: err => {
        this.signupError = (err.body as PeerTubeProblemDocument)?.detail || err.message
      }
    })
  }

  dismissAllAfterDone () {
    this.ngbModal.dismissAll('signup-done')
  }

  private autoLogin (body: UserRegister) {
    this.authService.login({ username: body.username, password: body.password })
      .subscribe({
        next: () => {
          this.signupSuccess = true

          // 注册即登录:短暂展示成功提示后关闭全部弹框(含底层的登录弹框)
          setTimeout(() => this.dismissAllAfterDone(), 1800)
        },

        error: err => {
          this.signupError = err.message
        }
      })
  }
}
