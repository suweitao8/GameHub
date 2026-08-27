import { Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'

// ---------------------------------------------------------------------------

export const REQUIRED_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required ],
  MESSAGES: {
    required: $localize`This field is required.`
  }
}

export const REQUIRED_EMAIL_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, Validators.email ],
  MESSAGES: {
    required: $localize`Email is required.`,
    email: $localize`Email must be valid.`
  }
}
