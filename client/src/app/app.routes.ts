import { Routes, UrlMatchResult, UrlSegment } from '@angular/router'
import { AVAILABLE_LOCALES } from '@peertube/peertube-core-utils'
import { MetaGuard } from './core'
import { EmptyComponent } from './empty.component'
import { HomepageRedirectComponent } from './homepage-redirect.component'
import { USER_USERNAME_REGEX_CHARACTERS } from './shared/form-validators/user-validators'
import { ActorRedirectGuard } from './shared/shared-main/router/actor-redirect-guard.service'

const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./+admin/routes'),
    canActivateChild: [ MetaGuard ]
  },

  // ---------------------------------------------------------------------------

  {
    path: 'my-account',
    loadChildren: () => import('./+my-account/routes'),
    canActivateChild: [ MetaGuard ]
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
    redirectTo: 'a'
  },
  {
    path: 'a',
    loadChildren: () => import('./+accounts/routes'),
    canActivateChild: [ MetaGuard ]
  },

  // ---------------------------------------------------------------------------

  {
    path: 'video-channels',
    redirectTo: '/games',
    pathMatch: 'prefix'
  },
  {
    path: 'c',
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
    path: 'about',
    loadChildren: () => import('./+about/routes'),
    canActivateChild: [ MetaGuard ]
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
    path: 'studio/edit/:videoId',
    redirectTo: '/games',
    pathMatch: 'full'
  },

  {
    path: 'stats/videos/:videoId',
    redirectTo: '/games',
    pathMatch: 'full'
  },

  {
    path: 'videos/upload',
    redirectTo: '/games',
    pathMatch: 'full'
  },
  {
    path: 'videos/browse',
    redirectTo: '/games',
    pathMatch: 'full'
  },
  {
    path: 'videos/update/:uuid',
    pathMatch: 'full',
    redirectTo: '/games'
  },

  {
    path: 'videos/manage/:uuid',
    redirectTo: '/games',
    pathMatch: 'full'
  },

  {
    path: 'videos/publish',
    redirectTo: '/games',
    pathMatch: 'full'
  },

  // ---------------------------------------------------------------------------

  {
    path: 'video-playlists/watch',
    redirectTo: '/games'
  },

  {
    path: 'videos/watch/playlist',
    redirectTo: '/games'
  },
  {
    path: 'videos/watch',
    redirectTo: '/games'
  },
  {
    path: 'w',
    redirectTo: '/games'
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
    loadChildren: () => import('./+remote-interaction/routes'),
    canActivateChild: [ MetaGuard ]
  },

  // ---------------------------------------------------------------------------
  // /@:actorName
  // ---------------------------------------------------------------------------
  {
    matcher: (url): UrlMatchResult => {
      const regex = new RegExp(`^@(${USER_USERNAME_REGEX_CHARACTERS}+)$`)
      if (url.length !== 1) return null

      const matchResult = url[0].path.match(regex)
      if (!matchResult) return null

      return {
        consumed: url,
        posParams: {
          actorName: new UrlSegment(matchResult[1], {})
        }
      }
    },
    pathMatch: 'full',
    canActivate: [ ActorRedirectGuard ],
    component: EmptyComponent
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
  loadChildren: () => import('./+error-page/routes')
})

export default routes
