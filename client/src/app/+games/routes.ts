import { Routes } from '@angular/router'
import { GamesService } from './games.service'
import { GameLoginGuard } from './game-login.guard'

export default [
  {
    path: '',
    providers: [ GamesService ],
    children: [
      {
        path: 'author/:accountId',
        loadComponent: () => import('./game-author.component').then(m => m.GameAuthorComponent),
        data: { meta: { title: $localize`Author space` } }
      },
      {
        path: 'creator',
        loadComponent: () => import('./game-creator.component').then(m => m.GameCreatorComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`Creator center` } }
      },
      {
        path: 'analytics',
        loadComponent: () => import('./game-analytics-dashboard.component').then(m => m.GameAnalyticsDashboardComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`Analytics dashboard` } }
      },
      {
        path: 'notifications',
        loadComponent: () => import('./game-notifications.component').then(m => m.GameNotificationsComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`GameHub notifications` } }
      },
      {
        path: 'edit/:uuid',
        loadComponent: () => import('./game-edit.component').then(m => m.GameEditComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`Edit game` } }
      },
      {
        path: 'library',
        loadComponent: () => import('./game-library.component').then(m => m.GameLibraryComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`My games` } }
      },
      {
        path: 'upload',
        loadComponent: () => import('./game-upload.component').then(m => m.GameUploadComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`Upload game` } }
      },
      {
        path: 'manage',
        loadComponent: () => import('./game-manage.component').then(m => m.GameManageComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`Moderate games` } }
      },
      {
        path: 'rankings',
        loadComponent: () => import('./game-rankings.component').then(m => m.GameRankingsComponent),
        data: { meta: { title: $localize`Game rankings` } }
      },
      {
        path: 'activity',
        loadComponent: () => import('./game-activity-feed.component').then(m => m.GameActivityFeedComponent),
        data: { meta: { title: $localize`Community activity` } }
      },
      {
        path: 'reservations',
        loadComponent: () => import('./game-reservations.component').then(m => m.GameReservationsComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`My reservations` } }
      },
      {
        path: 'collections',
        loadComponent: () => import('./game-collections.component').then(m => m.GameCollectionsComponent),
        data: { meta: { title: $localize`Game collections` } }
      },
      {
        path: 'collection/:slug',
        loadComponent: () => import('./game-collection-detail.component').then(m => m.GameCollectionDetailComponent),
        data: { meta: { title: $localize`Collection` } }
      },
      {
        path: 'articles',
        loadComponent: () => import('./game-articles.component').then(m => m.GameArticlesComponent),
        data: { meta: { title: $localize`Game articles` } }
      },
      {
        path: 'articles/new',
        loadComponent: () => import('./game-article-editor.component').then(m => m.GameArticleEditorComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`Write game article` } }
      },
      {
        path: 'articles/:slug/edit',
        loadComponent: () => import('./game-article-editor.component').then(m => m.GameArticleEditorComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`Edit game article` } }
      },
      {
        path: 'articles/:slug',
        loadComponent: () => import('./game-article-detail.component').then(m => m.GameArticleDetailComponent),
        data: { meta: { title: $localize`Game article` } }
      },
      {
        path: 'tags',
        loadComponent: () => import('./game-tags-cloud.component').then(m => m.GameTagsCloudComponent),
        data: { meta: { title: $localize`Popular tags` } }
      },
      {
        path: 'events',
        loadComponent: () => import('./game-events.component').then(m => m.GameEventsComponent),
        data: { meta: { title: $localize`Game events` } }
      },
      {
        path: 'event/:slug',
        loadComponent: () => import('./game-event-detail.component').then(m => m.GameEventDetailComponent),
        data: { meta: { title: $localize`Event detail` } }
      },
      {
        path: 'event-admin',
        loadComponent: () => import('./game-event-admin.component').then(m => m.GameEventAdminComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`Event admin` } }
      },
      {
        path: 'following',
        loadComponent: () => import('./game-following.component').then(m => m.GameFollowingComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`My following` } }
      },
      {
        path: 'watch-later',
        loadComponent: () => import('./game-watch-later.component').then(m => m.GameWatchLaterComponent),
        data: { meta: { title: $localize`Watch later` } }
      },
      {
        path: 'search',
        loadComponent: () => import('./games-home.component').then(m => m.GamesHomeComponent),
        data: { meta: { title: $localize`Search games` } }
      },
      {
        path: 'community',
        loadComponent: () => import('./games-home.component').then(m => m.GamesHomeComponent),
        data: { meta: { title: $localize`GameHub community` } }
      },
      {
        path: '',
        loadComponent: () => import('./games-home.component').then(m => m.GamesHomeComponent),
        data: { meta: { title: $localize`Discover games` } }
      },
      {
        path: ':uuid',
        loadComponent: () => import('./game-play.component').then(m => m.GamePlayComponent),
        data: { meta: { title: $localize`Play game` } }
      }
    ]
  }
] satisfies Routes
