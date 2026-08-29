import { Routes } from '@angular/router'
import { VerifyNewAccountAskSendEmailComponent } from './verify-new-account-ask-send-email/verify-new-account-ask-send-email.component'
import { VerifyAccountEmailComponent } from './verify-account-email/verify-account-email.component'
import { SignupService } from '../shared/signup.service'

export default [
  {
    path: '',
    providers: [ SignupService ],
    children: [
      {
        path: 'email',
        component: VerifyAccountEmailComponent,
        data: {
          meta: {
            title: $localize`通过邮箱验证账户`
          }
        }
      },
      {
        path: 'ask-send-email',
        component: VerifyNewAccountAskSendEmailComponent,
        data: {
          meta: {
            title: $localize`申请发送账户验证邮件`
          }
        }
      }
    ]
  }
] satisfies Routes
