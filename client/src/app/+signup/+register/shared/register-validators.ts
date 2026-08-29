import { Validators } from '@angular/forms'
import { BuildFormValidator } from '@app/shared/form-validators/form-validator.model'

export const REGISTER_TERMS_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.requiredTrue ],
  MESSAGES: {
    required: $localize`您必须同意平台条款才能注册。`
  }
}

export const REGISTER_REASON_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.minLength(2), Validators.maxLength(3000) ],
  MESSAGES: {
    required: $localize`请填写注册理由。`,
    minlength: $localize`注册理由至少需要 2 个字符。`,
    maxlength: $localize`注册理由不能超过 3000 个字符。`
  }
}
