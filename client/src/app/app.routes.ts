import { Routes, UrlMatchResult, UrlMatcher } from '@angular/router'
import { AVAILABLE_LOCALES } from '@peertube/peertube-core-utils'
import { MetaGuard } from './core'
import { HomepageRedirectComponent } from './homepage-redirect.component'
import { GameNotFoundComponent } from './game-not-found.component'
import { GameAccountHomeComponent } from './game-account-home.component'
import { GameAccountSettingsComponent } from './game-account-settings.component'
import { GameAboutComponent } from './game-about.component'
import { USER_USERNAME_REGEX_CHARACTERS } from './shared/form-validators/user-validators'

/** PeerTube video/admin legacy paths — always bounce to GameHub games hub. */
const legacyVideoPrefixes = [
  'videos',
  'video-channels',
  'c',
  'w',
  'video-playlists',
  'studio',
  'stats/videos',
  'home',
  'search',
  'admin',
  'remote-interaction',
  'my-library'
]

const legacyPathMatcher: UrlMatcher = url => {
  if (!url.length) return null

  const path = url.map(segment => segment.path).join('/')
  const isLegacy = legacyVideoPrefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`))

  return isLegacy ? { consumed: url } : null
}

const gameAboutMatcher: UrlMatcher = url => {
  if (!url.length || url[0].path !== 'about') return null

  return { consumed: url }
}

const routes: Routes = [
  {
    matcher: gameAboutMatcher,
    component: GameAboutComponent,
    data: { meta: { title: $localize`About GameHub` } }
  },

  {
    path: 'my-account/settings',
    component: GameAccountSettingsComponent,
    pathMatch: 'full'
  },
  {
    path: 'my-account',
    component: GameAccountHomeComponent,
    pathMatch: 'full'
  },

  {
    path: 'verify-account',
    loadChildren: () => import('./+signup/+verify-account/routes'),
    canActivateChild: [ MetaGuard ]
  },

  {
    path: 'accounts',
    redirectTo: '/games',
    pathMatch: 'prefix'
  },
  {
    path: 'a',
    redirectTo: '/games',
    pathMatch: 'prefix'
  },

  {
    path: 'manage/create',
    redirectTo: '/games/creator',
    pathMatch: 'full'
  },
  {
    path: 'manage/update/:channel',
    pathMatch: 'full',
    redirectTo: '/games/creator'
  },

  {
    path: 'p',
    loadChildren: () => import('./shared/shared-plugin-pages/routes'),
    canActivateChild: [ MetaGuard ],
    data: {
      parentRoute: '/'
    }
  },

  {
    path: 'signup',
    loadChildren: () => import('./+signup/+register/routes'),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'reset-password',
    loadChildren: () => import('./+reset-password/routes'),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'login',
    loadChildren: () => import('./+login/routes'),
    canActivateChild: [ MetaGuard ]
  },
  {
    path: 'games',
    loadChildren: () => import('./+games/routes'),
    canActivateChild: [ MetaGuard ]
  },

  // All leftover PeerTube video/admin URLs → games (no legacy placeholder UI)
  {
    matcher: legacyPathMatcher,
    redirectTo: '/games'
  },

  // Legacy PeerTube actor profiles → games hub
  {
    matcher: (url): UrlMatchResult => {
      const regex = new RegExp(`^@(${USER_USERNAME_REGEX_CHARACTERS}+)$`)
      if (url.length !== 1) return null
      if (!regex.test(url[0].path)) return null
      return { consumed: url }
    },
    pathMatch: 'full',
    redirectTo: '/games'
  },

  {
    path: '',
    component: HomepageRedirectComponent
  }
]

// Avoid 404 when changing language
for (const locale of AVAILABLE_LOCALES) {
  routes.push({
    path: locale,
    component: HomepageRedirectComponent
  })
}

routes.push({
  path: '**',
  component: GameNotFoundComponent
})

export default routes
