import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'
import { USER_USERNAME_VALIDATOR } from './user-validators'

export const VIDEO_CHANNEL_NAME_VALIDATOR: BuildFormValidator = {
  // Use the same constraints than user username
  VALIDATORS: USER_USERNAME_VALIDATOR.VALIDATORS,

  MESSAGES: {
    required: $localize`Name is required.`,
    minlength: $localize`Name must be at least 1 character long.`,
    maxlength: $localize`Name cannot be more than 50 characters long.`,
    pattern: $localize`Name should be lowercase alphanumeric; dots and underscores are allowed.`
  }
}

export const VIDEO_CHANNEL_DISPLAY_NAME_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [
    Validators.required,
    Validators.minLength(1),
    Validators.maxLength(50)
  ],
  MESSAGES: {
    required: $localize`Display name is required.`,
    minlength: $localize`Display name must be at least 1 character long.`,
    maxlength: $localize`Display name cannot be more than 50 characters long.`
  }
}
