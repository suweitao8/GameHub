import { Routes } from '@angular/router'
import { ResetPasswordComponent } from './reset-password.component'

export default [
  {
    path: '',
    component: ResetPasswordComponent,
    data: {
      meta: {
        title: $localize`重置密码`
      }
    }
  }
] satisfies Routes
