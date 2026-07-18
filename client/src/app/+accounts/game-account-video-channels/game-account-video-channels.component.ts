import { DatePipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { MarkdownService } from '@app/core'
import { Account } from '@app/shared/shared-main/account/account.model'
import { AccountService } from '@app/shared/shared-main/account/account.service'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { Video } from '@app/shared/shared-main/video/video.model'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { firstValueFrom, Subscription } from 'rxjs'
import { ActorAvatarComponent } from '../../shared/shared-actor-image/actor-avatar.component'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { SubscribeButtonComponent } from '../../shared/shared-user-subscription/subscribe-button.component'

@Component({
  selector: 'my-game-account-video-channels',
  templateUrl: './game-account-video-channels.component.html',
  styleUrl: './game-account-video-channels.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ DatePipe, RouterLink, ActorAvatarComponent, GlobalIconComponent, SubscribeButtonComponent ]
})
export class GameAccountVideoChannelsComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute)
  private readonly accountService = inject(AccountService)
  private readonly videoChannelService = inject(VideoChannelService)
  private readonly videoService = inject(VideoService)
  private readonly markdown = inject(MarkdownService)

  readonly account = signal<Account>(undefined)
  readonly videoChannels = signal<VideoChannel[]>([])
  readonly videos = signal<Record<number, Video[]>>({})
  readonly accountDescriptionHTML = signal('')
  readonly loading = signal(true)
  readonly error = signal(false)

  private routeSub: Subscription

  ngOnInit () {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const accountId = params.get('accountId')
      if (accountId) void this.loadAccount(accountId)
    })
  }

  ngOnDestroy () {
    this.routeSub?.unsubscribe()
  }

  getChannelLink () {
    return [ '/games/author', this.account()?.id ]
  }

  getVideoLink (video: Video) {
    return [ '/w', video.shortUUID || video.uuid ]
  }

  getVideos (channel: VideoChannel) {
    return this.videos()[channel.id] || []
  }

  getThumbnail (video: Video) {
    return video.thumbnails?.[0]?.fileUrl || ''
  }

  formatCount (value: number | undefined) {
    if (!value) return '0'
    if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
    return `${value}`
  }

  private async loadAccount (accountId: string) {
    this.loading.set(true)
    this.error.set(false)

    try {
      const account = await firstValueFrom(this.accountService.getAccount(accountId))
      const description = await this.markdown.textMarkdownToHTML({ markdown: account.description, withEmoji: true, withHtml: true })
      const channelResult = await firstValueFrom(this.videoChannelService.listAccountChannels({ account, sort: '-updatedAt' }))
      const channelVideos = await Promise.all(channelResult.data.map(async channel => {
        const result = await firstValueFrom(this.videoService.listChannelVideos({
          videoChannel: channel,
          videoPagination: { currentPage: 1, itemsPerPage: 4, totalItems: null },
          sort: '-publishedAt'
        }))
        return [ channel.id, result.data ] as const
      }))

      this.account.set(account)
      this.accountDescriptionHTML.set(description)
      this.videoChannels.set(channelResult.data)
      this.videos.set(Object.fromEntries(channelVideos))
      this.loading.set(false)
    } catch {
      this.error.set(true)
      this.loading.set(false)
    }
  }
}
