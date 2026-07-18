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
