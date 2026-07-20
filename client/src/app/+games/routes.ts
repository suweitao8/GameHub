import { Routes } from '@angular/router'
import { GamesHomeComponent } from './games-home.component'
import { GamesService } from './games.service'
import { GamePlayComponent } from './game-play.component'
import { GameUploadComponent } from './game-upload.component'
import { GameManageComponent } from './game-manage.component'
import { GameLibraryComponent } from './game-library.component'
import { GameEditComponent } from './game-edit.component'
import { GameAuthorComponent } from './game-author.component'
import { GameCreatorComponent } from './game-creator.component'
import { GameNotificationsComponent } from './game-notifications.component'
import { GameLoginGuard } from './game-login.guard'
import { GameActivityFeedComponent } from './game-activity-feed.component'
import { GameReservationsComponent } from './game-reservations.component'
import { GameRankingsComponent } from './game-rankings.component'
import { GameAnalyticsDashboardComponent } from './game-analytics-dashboard.component'
import { GameCollectionsComponent } from './game-collections.component'
import { GameCollectionDetailComponent } from './game-collection-detail.component'
import { GameEventsComponent } from './game-events.component'
import { GameEventDetailComponent } from './game-event-detail.component'
import { GameEventAdminComponent } from './game-event-admin.component'
import { GameFollowingComponent } from './game-following.component'
import { GameArticlesComponent } from './game-articles.component'

export default [
  {
    path: '',
    providers: [ GamesService ],
    children: [
      {
        path: 'author/:accountId',
        component: GameAuthorComponent,
        data: { meta: { title: $localize`Author space` } }
      },
      {
        path: 'creator',
        component: GameCreatorComponent,
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`Creator center` } }
      },
      {
        path: 'analytics',
        component: GameAnalyticsDashboardComponent,
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`Analytics dashboard` } }
      },
      {
        path: 'notifications',
        component: GameNotificationsComponent,
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`GameHub notifications` } }
      },
      {
        path: 'edit/:uuid',
        component: GameEditComponent,
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`Edit game` } }
      },
      {
        path: 'library',
        component: GameLibraryComponent,
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`My games` } }
      },
      {
        path: 'upload',
        component: GameUploadComponent,
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`Upload game` } }
      },
      {
        path: 'manage',
        component: GameManageComponent,
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`Moderate games` } }
      },
      {
        path: 'search',
        component: GamesHomeComponent,
        data: { meta: { title: $localize`Search games` } }
      },
      {
        path: 'community',
        component: GamesHomeComponent,
        data: { meta: { title: $localize`GameHub community` } }
      },
      {
        path: 'rankings',
        component: GameRankingsComponent,
        data: { meta: { title: $localize`Game rankings` } }
      },
      {
        path: 'activity',
        component: GameActivityFeedComponent,
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`Community activity` } }
      },
      {
        path: 'reservations',
        component: GameReservationsComponent,
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`My reservations` } }
      },
      {
        path: 'collections',
        component: GameCollectionsComponent,
        data: { meta: { title: $localize`Game collections` } }
      },
      {
        path: 'collection/:slug',
        component: GameCollectionDetailComponent,
        data: { meta: { title: $localize`Collection` } }
      },
      {
        path: 'articles',
        component: GameArticlesComponent,
        data: { meta: { title: $localize`Game articles` } }
      },
      {
        path: 'events',
        component: GameEventsComponent,
        data: { meta: { title: $localize`Game events` } }
      },
      {
        path: 'event/:slug',
        component: GameEventDetailComponent,
        data: { meta: { title: $localize`Event detail` } }
      },
      {
        path: 'event-admin',
        component: GameEventAdminComponent,
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`Event admin` } }
      },
      {
        path: 'following',
        component: GameFollowingComponent,
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`My following` } }
      },
      {
        path: '',
        component: GamesHomeComponent,
        data: { meta: { title: $localize`Discover games` } }
      },
      {
        path: ':uuid',
        component: GamePlayComponent,
        data: { meta: { title: $localize`Play game` } }
      }
    ]
  }
] satisfies Routes
