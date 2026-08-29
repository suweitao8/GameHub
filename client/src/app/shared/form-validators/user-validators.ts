import { ValidatorFn, Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

export const USER_USERNAME_REGEX_CHARACTERS = '[a-z0-9][a-z0-9._]'

export const USER_USERNAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required,
    Validators.minLength(1),
    Validators.maxLength(50),
    Validators.pattern(new RegExp(`^${USER_USERNAME_REGEX_CHARACTERS}*$`))
  ],
  MESSAGES: {
    required: $localize`请输入用户名。`,
    minlength: $localize`用户名至少需要 1 个字符。`,
    maxlength: $localize`用户名不能超过 50 个字符。`,
    pattern: $localize`用户名只能使用小写字母、数字、点和下划线。`
  }
}

export const USER_EXISTING_PASSWORD_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required
  ],
  MESSAGES: {
    required: $localize`请输入密码。`
  }
}

export const USER_OTP_TOKEN_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required
  ],
  MESSAGES: {
    required: $localize`请输入一次性验证码。`
  }
}

export function getUserNewPasswordValidator (minLength: number, maxLength: number) {
  const base = getUserNewPasswordOptionalValidator(minLength, maxLength)

  return {
    VALIDATORS: [
      Validators.required,

      ...base.VALIDATORS
    ] as ValidatorFn[],
    MESSAGES: {
      required: $localize`请输入密码。`,

      ...base.MESSAGES
    }
  }
}

function getUserNewPasswordOptionalValidator (minLength: number, maxLength: number) {
  return {
    VALIDATORS: [
      Validators.minLength(minLength),
      Validators.maxLength(maxLength)
    ] as ValidatorFn[],
    MESSAGES: {
      minlength: $localize`密码至少需要 ${minLength} 个字符。`,
      maxlength: $localize`密码不能超过 ${maxLength} 个字符。`
    }
  }
}

export const USER_CONFIRM_PASSWORD_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [],
  MESSAGES: {
    matchPassword: $localize`两次输入的密码不一致。`
  }
}

export const USER_DISPLAY_NAME_REQUIRED_VALIDATOR = buildDisplayNameValidator(true)

function buildDisplayNameValidator (required: boolean) {
  const control = {
    VALIDATORS: [
      Validators.minLength(1),
      Validators.maxLength(120)
    ],
    MESSAGES: {
      required: $localize`请输入显示名称。`,
      minlength: $localize`显示名称至少需要 1 个字符。`,
      maxlength: $localize`显示名称不能超过 50 个字符。`
    }
  }

  if (required) control.VALIDATORS.push(Validators.required)

  return control
}
