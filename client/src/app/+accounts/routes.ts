import { Routes, UrlMatchResult, UrlSegment } from '@angular/router'
import { AbuseService } from '@app/shared/shared-moderation/abuse.service'
import { BlocklistService } from '@app/shared/shared-moderation/blocklist.service'
import { BulkService } from '@app/shared/shared-moderation/bulk.service'
import { VideoBlockService } from '@app/shared/shared-moderation/video-block.service'
import { UserSubscriptionService } from '@app/shared/shared-user-subscription/user-subscription.service'
import { UserAdminService } from '@app/shared/shared-users/user-admin.service'
import { AccountVideoChannelsComponent } from './account-video-channels/account-video-channels.component'
import { AccountsComponent } from './accounts.component'
import { GameAccountVideoChannelsComponent } from './game-account-video-channels/game-account-video-channels.component'

const gameAccountVideoChannelsMatcher = (segments: UrlSegment[]): UrlMatchResult | null => {
  if (segments.length === 2 && segments[1].path === 'video-channels') {
    return { consumed: segments, posParams: { accountId: segments[0] } }
  }

  return null
}

const legacyAccountVideosMatcher = (segments: UrlSegment[]): UrlMatchResult | null => {
  if (segments.length === 2 && segments[1].path === 'videos') return { consumed: segments }
  return null
}

export default [
  {
    path: 'peertube',
    redirectTo: '/games'
  },
  {
    matcher: gameAccountVideoChannelsMatcher,
    component: GameAccountVideoChannelsComponent,
    providers: [ UserSubscriptionService ]
  },
  {
    matcher: legacyAccountVideosMatcher,
    redirectTo: '/games'
  },
  {
    path: ':accountId',
    component: AccountsComponent,
    providers: [
      UserSubscriptionService,
      BlocklistService,
      VideoBlockService,
      AbuseService,
      UserAdminService,
      BulkService
    ],
    children: [
      {
        path: '',
        redirectTo: 'video-channels',
        pathMatch: 'full'
      },
      {
        path: 'video-channels',
        component: AccountVideoChannelsComponent
      },
      {
        path: 'videos',
        redirectTo: '/games',
        pathMatch: 'full'
      },
      // Old URL redirection
      {
        path: 'search',
        redirectTo: 'videos'
      }
    ]
  }
] satisfies Routes
