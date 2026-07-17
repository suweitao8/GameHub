import { Routes } from '@angular/router'
import { GamesHomeComponent } from '@app/+games/games-home.component'
import { GamesService } from '@app/+games/games.service'

export default [
  {
    path: '',
    component: GamesHomeComponent,
    providers: [ GamesService ],
    data: {
      meta: {
        title: $localize`Homepage`
      },
      reuse: {
        enabled: true,
        key: 'home'
      }
    }
  }
] satisfies Routes
