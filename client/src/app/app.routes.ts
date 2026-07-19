import { Routes, UrlMatchResult, UrlMatcher } from '@angular/router'
import { AVAILABLE_LOCALES } from '@peertube/peertube-core-utils'
import { MetaGuard } from './core'
import { HomepageRedirectComponent } from './homepage-redirect.component'
import { GameNotFoundComponent } from './game-not-found.component'
import { GameAccountHomeComponent } from './game-account-home.component'
import { GameAccountSettingsComponent } from './game-account-settings.component'
import { GameAboutComponent } from './game-about.component'
import { LegacyFeaturePlaceholderComponent } from './legacy-feature-placeholder.component'
import { USER_USERNAME_REGEX_CHARACTERS } from './shared/form-validators/user-validators'

const legacyVideoPrefixes = [ 'videos', 'video-channels', 'c', 'w', 'video-playlists', 'studio', 'stats/videos' ]

const legacyVideoMatcher: UrlMatcher = url => {
  if (!url.length) return null

  const path = url.map(segment => segment.path).join('/')
  const isLegacyVideoPath = legacyVideoPrefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`))

  return isLegacyVideoPath ? { consumed: url } : null
}

const legacyAdminMatcher: UrlMatcher = url => {
  if (!url.length || url[0].path !== 'admin') return null

  return { consumed: url }
}

const gameAboutMatcher: UrlMatcher = url => {
  if (!url.length || url[0].path !== 'about') return null

  return { consumed: url }
}

const routes: Routes = [
  {
    matcher: legacyAdminMatcher,
    component: LegacyFeaturePlaceholderComponent
  },

  {
    matcher: gameAboutMatcher,
    component: GameAboutComponent,
    data: { meta: { title: $localize`About GameHub` } }
  },

  // ---------------------------------------------------------------------------

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
    path: 'my-library',
    redirectTo: '/games',
    pathMatch: 'prefix'
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

  // ---------------------------------------------------------------------------

  {
    path: 'video-channels',
    component: LegacyFeaturePlaceholderComponent
  },
  {
    path: 'c',
    component: LegacyFeaturePlaceholderComponent
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

  // ---------------------------------------------------------------------------

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
    path: 'search',
    redirectTo: '/games',
    pathMatch: 'full'
  },
  {
    path: 'games',
    loadChildren: () => import('./+games/routes'),
    canActivateChild: [ MetaGuard ]
  },

  // ---------------------------------------------------------------------------

  {
    matcher: legacyVideoMatcher,
    component: LegacyFeaturePlaceholderComponent
  },

  // ---------------------------------------------------------------------------
  // Legacy home and video routes are intentionally hidden in GameHub.
  // ---------------------------------------------------------------------------
  {
    matcher: (url): UrlMatchResult => {
      if (url.length < 1) return null

      const matchResult = url[0].path === 'home' || url[0].path === 'videos'
      if (!matchResult) return null

      return { consumed: url }
    },
    redirectTo: '/games'
  },

  // ---------------------------------------------------------------------------

  {
    path: 'remote-interaction',
    component: LegacyFeaturePlaceholderComponent
  },

  // ---------------------------------------------------------------------------
  // Legacy PeerTube actor profiles are replaced by GameHub author pages.
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------

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
