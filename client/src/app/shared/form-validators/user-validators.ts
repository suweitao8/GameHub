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
    required: $localize`Username is required.`,
    minlength: $localize`Username must be at least 1 character long.`,
    maxlength: $localize`Username cannot be more than 50 characters long.`,
    pattern: $localize`Username should be lowercase alphanumeric; dots and underscores are allowed.`
  }
}

export const USER_EXISTING_PASSWORD_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required
  ],
  MESSAGES: {
    required: $localize`Password is required.`
  }
}

export const USER_OTP_TOKEN_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required
  ],
  MESSAGES: {
    required: $localize`OTP token is required.`
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
      required: $localize`Password is required.`,

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
      minlength: $localize`Password must be at least ${minLength} characters long.`,
      maxlength: $localize`Password cannot be more than ${maxLength} characters long.`
    }
  }
}

export const USER_CONFIRM_PASSWORD_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [],
  MESSAGES: {
    matchPassword: $localize`The new password and the confirmed password do not correspond.`
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
      required: $localize`Display name is required.`,
      minlength: $localize`Display name must be at least 1 character long.`,
      maxlength: $localize`Display name cannot be more than 50 characters long.`
    }
  }

  if (required) control.VALIDATORS.push(Validators.required)

  return control
}
