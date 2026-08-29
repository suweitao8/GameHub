import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

// ---------------------------------------------------------------------------

export const REQUIRED_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    required: $localize`此字段为必填项。`
  }
}

export const REQUIRED_EMAIL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.email ],
  MESSAGES: {
    required: $localize`请输入邮箱。`,
    email: $localize`请输入有效的邮箱地址。`
  }
}
