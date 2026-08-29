import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { HttpStatusCode } from '@peertube/peertube-models'
import { AuthService, Notifier, ServerService, UserService } from '@app/core'
import {
  USER_CONFIRM_PASSWORD_VALIDATOR,
  USER_EXISTING_PASSWORD_VALIDATOR,
  getUserNewPasswordValidator
} from '@app/shared/form-validators/user-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { InputTextComponent } from './shared/shared-forms/input-text.component'
import { filter, take } from 'rxjs/operators'
import { GAME_FEATURES } from './+games/shared'

@Component({
  template: `
    <main class="game-community-page game-settings-page">
      <div class="game-community-content">
        <header class="game-settings-header">
          <p class="game-eyebrow">GameHub 账户</p>
          <h1>账户设置</h1>
          <p>管理登录安全和账户相关选项。</p>
        </header>

        <section class="game-settings-card">
          <div class="game-settings-card-heading">
            <div>
              <h2>昵称</h2>
              <p>昵称是展示给他人的名字，随时可以修改；用户名用于登录，不能修改。</p>
            </div>
            <span class="game-settings-badge">资料</span>
          </div>

          @if (nicknameError) {
            <my-alert type="danger">{{ nicknameError }}</my-alert>
          }

          <form (ngSubmit)="saveNickname()" class="game-password-form game-nickname-form">
            <input
              type="text" id="game-nickname" class="form-control" i18n-placeholder
              placeholder="展示给他人的名字，最多 120 个字符" maxlength="120"
              [(ngModel)]="nickname" name="nickname" autocomplete="nickname"
            >
            <button class="game-settings-submit" type="submit" [disabled]="nicknameSaving || !nickname.trim()">
              {{ nicknameSaving ? '正在保存…' : '保存昵称' }}
            </button>
          </form>
        </section>

        <section class="game-settings-card">
          <div class="game-settings-card-heading">
            <div>
              <h2>修改密码</h2>
              <p>定期更新密码可以保护你的账户安全。</p>
            </div>
            <span class="game-settings-badge">安全</span>
          </div>

          @if (error) {
            <my-alert type="danger">{{ error }}</my-alert>
          }

          <form (ngSubmit)="changePassword()" [formGroup]="form" class="game-password-form">
            <my-input-text
              formControlName="current-password" inputId="game-current-password" i18n-placeholder placeholder="当前密码"
              [formError]="formErrors['current-password']" autocomplete="current-password"
            ></my-input-text>
            <my-input-text
              formControlName="new-password" inputId="game-new-password" i18n-placeholder placeholder="新密码"
              [formError]="formErrors['new-password']" autocomplete="new-password"
            ></my-input-text>
            <my-input-text
              formControlName="new-confirmed-password" inputId="game-confirmed-password" i18n-placeholder placeholder="确认新密码"
              [formError]="formErrors['new-confirmed-password']" autocomplete="new-password"
            ></my-input-text>
            <button class="game-settings-submit" type="submit" [disabled]="!form.valid">保存新密码</button>
          </form>
        </section>

        <section class="game-settings-card game-settings-info">
          <h2>账户入口</h2>
          <div class="game-settings-links">
            <a routerLink="/my-account">个人中心 <span>→</span></a>
            @if (creatorEnabled) {
              <a routerLink="/games/creator">创作中心 <span>→</span></a>
            }
            <a routerLink="/games/notifications">消息中心 <span>→</span></a>
          </div>
        </section>
      </div>
    </main>
  `,
  styleUrl: './game-account-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ FormsModule, ReactiveFormsModule, RouterLink, InputTextComponent, AlertComponent ]
})
export class GameAccountSettingsComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private readonly serverService = inject(ServerService)
  private readonly userService = inject(UserService)
  private readonly authService = inject(AuthService)
  private readonly notifier = inject(Notifier)
  private readonly changeDetectorRef = inject(ChangeDetectorRef)

  error: string
  readonly creatorEnabled = GAME_FEATURES.creatorCenter

  nickname = ''
  nicknameSaving = false
  nicknameError: string

  ngOnInit () {
    const { minLength, maxLength } = this.serverService.getHTMLConfig().fieldsConstraints.users.password

    this.buildForm({
      'current-password': USER_EXISTING_PASSWORD_VALIDATOR,
      'new-password': getUserNewPasswordValidator(minLength, maxLength),
      'new-confirmed-password': USER_CONFIRM_PASSWORD_VALIDATOR
    })

    const confirmPasswordControl = this.form.get('new-confirmed-password')
    confirmPasswordControl.valueChanges
      .pipe(filter(value => value !== this.form.value['new-password']))
      .subscribe(() => confirmPasswordControl.setErrors({ matchPassword: true }))

    // 整页刷新时会话先恢复登录态、用户资料后到,等资料就绪再回显昵称,
    // 避免回退成用户名;OnPush 组件需手动标记检查
    this.authService.userInformationLoaded
      .pipe(
        filter(loaded => loaded),
        take(1)
      )
      .subscribe(() => {
        const authUser = this.authService.getUser()
        this.nickname = authUser?.account?.displayName ||
          authUser?.account?.name ||
          authUser?.username ||
          ''
        this.changeDetectorRef.markForCheck()
      })
  }

  saveNickname () {
    const displayName = this.nickname.trim()
    if (!displayName) {
      this.nicknameError = $localize`昵称不能为空。`
      return
    }

    this.nicknameError = null
    this.nicknameSaving = true

    this.userService.updateMyProfile({ displayName }).subscribe({
      next: () => {
        this.nicknameSaving = false
        this.notifier.success($localize`昵称已更新。`)
        // 同步全局登录用户信息，头像菜单等展示位立即使用新昵称
        this.authService.refreshUserInformation()
      },
      error: err => {
        this.nicknameSaving = false
        this.nicknameError = err.message
      }
    })
  }

  changePassword () {
    this.error = null

    const currentPassword = this.form.value['current-password']
    const newPassword = this.form.value['new-password']

    this.userService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.notifier.success($localize`密码已更新。`)
        this.form.reset()
      },
      error: err => {
        this.error = err.status === HttpStatusCode.UNAUTHORIZED_401 ? '当前密码不正确。' : err.message
      }
    })
  }
}
