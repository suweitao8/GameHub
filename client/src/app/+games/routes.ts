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
        data: { meta: { title: $localize`Creator center` } }
      },
      {
        path: 'notifications',
        component: GameNotificationsComponent,
        data: { meta: { title: $localize`GameHub notifications` } }
      },
      {
        path: 'edit/:uuid',
        component: GameEditComponent,
        data: { meta: { title: $localize`Edit game` } }
      },
      {
        path: 'library',
        component: GameLibraryComponent,
        data: { meta: { title: $localize`My games` } }
      },
      {
        path: 'upload',
        component: GameUploadComponent,
        data: { meta: { title: $localize`Upload game` } }
      },
      {
        path: 'manage',
        component: GameManageComponent,
        data: { meta: { title: $localize`Moderate games` } }
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
