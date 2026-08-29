import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'
import { USER_USERNAME_VALIDATOR } from './user-validators'

export const VIDEO_CHANNEL_NAME_VALIDATOR: BuildFormValidator = {
  // Use the same constraints than user username
  VALIDATORS: USER_USERNAME_VALIDATOR.VALIDATORS,

  MESSAGES: {
    required: $localize`请输入名称。`,
    minlength: $localize`名称至少需要 1 个字符。`,
    maxlength: $localize`名称不能超过 50 个字符。`,
    pattern: $localize`名称只能使用小写字母、数字、点和下划线。`
  }
}

export const VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required,
    Validators.minLength(1),
    Validators.maxLength(50)
  ],
  MESSAGES: {
    required: $localize`请输入显示名称。`,
    minlength: $localize`显示名称至少需要 1 个字符。`,
    maxlength: $localize`显示名称不能超过 50 个字符。`
  }
}
