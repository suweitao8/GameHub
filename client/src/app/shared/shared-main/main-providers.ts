import { AccountService } from './account/account.service'
import { AUTH_INTERCEPTOR_PROVIDER } from './http/auth-interceptor.service'
import { InstanceService } from './instance/instance.service'

export function getMainProviders () {
  return [
    AUTH_INTERCEPTOR_PROVIDER,
    AccountService,
    InstanceService
  ]
}
