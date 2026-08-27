import { environment } from '../../../environments/environment'

export function getAPIUrl () {
  return environment.apiUrl || window.location.origin
}

export function getOriginUrl () {
  return environment.originServerUrl || window.location.origin
}

export function getBackendUrl () {
  return environment.apiUrl || environment.originServerUrl || window.location.origin
}

export function getBackendHost () {
  return new URL(getBackendUrl()).host
}
