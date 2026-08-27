import { environment } from '../../environments/environment'

export function isOnDevLocale () {
  return environment.production === false && window.location.search === '?lang=fr'
}

export function getDevLocale () {
  return 'fr-FR'
}
