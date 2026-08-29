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
        data: { meta: { title: $localize`创作者主页` } }
      },
      {
        path: 'creator',
        loadComponent: () => import('./game-creator.component').then(m => m.GameCreatorComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`创作中心` } }
      },
      {
        path: 'analytics',
        loadComponent: () => import('./game-analytics-dashboard.component').then(m => m.GameAnalyticsDashboardComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`数据分析` } }
      },
      {
        path: 'notifications',
        loadComponent: () => import('./game-notifications.component').then(m => m.GameNotificationsComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`消息通知` } }
      },
      {
        path: 'edit/:uuid',
        loadComponent: () => import('./game-edit.component').then(m => m.GameEditComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`编辑游戏` } }
      },
      {
        path: 'library',
        loadComponent: () => import('./game-library.component').then(m => m.GameLibraryComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`我的游戏` } }
      },
      {
        path: 'upload',
        loadComponent: () => import('./game-upload.component').then(m => m.GameUploadComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`投稿游戏` } }
      },
      {
        path: 'manage',
        loadComponent: () => import('./game-manage.component').then(m => m.GameManageComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`管理游戏` } }
      },
      {
        path: 'rankings',
        loadComponent: () => import('./game-rankings.component').then(m => m.GameRankingsComponent),
        data: { meta: { title: $localize`游戏排行榜` } }
      },
      {
        path: 'activity',
        loadComponent: () => import('./game-activity-feed.component').then(m => m.GameActivityFeedComponent),
        data: { meta: { title: $localize`社区动态` } }
      },
      {
        path: 'reservations',
        loadComponent: () => import('./game-reservations.component').then(m => m.GameReservationsComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`我的预约` } }
      },
      {
        path: 'collections',
        loadComponent: () => import('./game-collections.component').then(m => m.GameCollectionsComponent),
        data: { meta: { title: $localize`游戏合集` } }
      },
      {
        path: 'collection/:slug',
        loadComponent: () => import('./game-collection-detail.component').then(m => m.GameCollectionDetailComponent),
        data: { meta: { title: $localize`合集详情` } }
      },
      {
        path: 'articles',
        loadComponent: () => import('./game-articles.component').then(m => m.GameArticlesComponent),
        data: { meta: { title: $localize`游戏文章` } }
      },
      {
        path: 'articles/new',
        loadComponent: () => import('./game-article-editor.component').then(m => m.GameArticleEditorComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`撰写游戏文章` } }
      },
      {
        path: 'articles/:slug/edit',
        loadComponent: () => import('./game-article-editor.component').then(m => m.GameArticleEditorComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`编辑游戏文章` } }
      },
      {
        path: 'articles/:slug',
        loadComponent: () => import('./game-article-detail.component').then(m => m.GameArticleDetailComponent),
        data: { meta: { title: $localize`游戏文章详情` } }
      },
      {
        path: 'tags',
        loadComponent: () => import('./game-tags-cloud.component').then(m => m.GameTagsCloudComponent),
        data: { meta: { title: $localize`热门标签` } }
      },
      {
        path: 'events',
        loadComponent: () => import('./game-events.component').then(m => m.GameEventsComponent),
        data: { meta: { title: $localize`游戏活动` } }
      },
      {
        path: 'event/:slug',
        loadComponent: () => import('./game-event-detail.component').then(m => m.GameEventDetailComponent),
        data: { meta: { title: $localize`活动详情` } }
      },
      {
        path: 'event-admin',
        loadComponent: () => import('./game-event-admin.component').then(m => m.GameEventAdminComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`活动管理` } }
      },
      {
        path: 'following',
        loadComponent: () => import('./game-following.component').then(m => m.GameFollowingComponent),
        canActivate: [ GameLoginGuard ],
        data: { meta: { title: $localize`我的关注` } }
      },
      {
        path: 'watch-later',
        loadComponent: () => import('./game-watch-later.component').then(m => m.GameWatchLaterComponent),
        data: { meta: { title: $localize`稍后再玩` } }
      },
      {
        path: 'search',
        loadComponent: () => import('./games-home.component').then(m => m.GamesHomeComponent),
        data: { meta: { title: $localize`搜索游戏` } }
      },
      {
        path: 'community',
        loadComponent: () => import('./games-home.component').then(m => m.GamesHomeComponent),
        data: { meta: { title: $localize`GameHub 社区` } }
      },
      {
        path: '',
        loadComponent: () => import('./games-home.component').then(m => m.GamesHomeComponent),
        data: { meta: { title: $localize`发现游戏` } }
      },
      {
        path: ':uuid',
        loadComponent: () => import('./game-play.component').then(m => m.GamePlayComponent),
        data: { meta: { title: $localize`开始游戏` } }
      }
    ]
  }
] satisfies Routes
