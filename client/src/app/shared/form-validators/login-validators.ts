import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

export const LOGIN_USERNAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required
  ],
  MESSAGES: {
    required: $localize`请输入用户名。`
  }
}

export const LOGIN_PASSWORD_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required
  ],
  MESSAGES: {
    required: $localize`请输入密码。`
  }
}
