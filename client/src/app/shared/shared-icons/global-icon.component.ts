import { ChangeDetectionStrategy, Component, ElementRef, OnInit, inject, input } from '@angular/core'
import { HooksService } from '@app/core/plugins/hooks.service'

const icons = {
  // misc icons
  'markdown': require('../../../assets/images/misc/markdown.svg'),
  'language': require('../../../assets/images/misc/language.svg'),
  'video-lang': require('../../../assets/images/misc/video-lang.svg'),
  'support': require('../../../assets/images/misc/support.svg'),
  'peertube-x': require('../../../assets/images/misc/peertube-x.svg'),
  'robot': require('../../../assets/images/misc/miscellaneous-services.svg'), // material ui
  'playlist-add': require('../../../assets/images/misc/playlist-add.svg'), // material ui
  'follower': require('../../../assets/images/misc/account-arrow-left.svg'), // material ui
  'following': require('../../../assets/images/misc/account-arrow-right.svg'), // material ui
  'tip': require('../../../assets/images/misc/tip.svg'), // material ui
  'flame': require('../../../assets/images/misc/flame.svg'),
  'fediverse': require('../../../assets/images/misc/fediverse.svg'),
  'mastodon': require('../../../assets/images/misc/mastodon.svg'),
  'x-twitter': require('../../../assets/images/misc/x-twitter.svg'),
  'bluesky': require('../../../assets/images/misc/bluesky.svg'),

  // Tabler outline icons used by GameHub. Public names stay stable so existing
  // templates and third-party hooks do not need to change.
  'menu': require('../../../assets/images/tabler/menu-2.svg'),
  'link': require('../../../assets/images/feather/link.svg'),
  'history': require('../../../assets/images/feather/history.svg'),
  'registry': require('../../../assets/images/feather/registry.svg'),
  'subscriptions': require('../../../assets/images/feather/subscriptions.svg'),
  'videos': require('../../../assets/images/feather/videos.svg'),
  'add': require('../../../assets/images/feather/plus.svg'),
  'plus': require('../../../assets/images/feather/plus.svg'),
  'alert': require('../../../assets/images/feather/alert.svg'),
  'alert-circle': require('../../../assets/images/feather/circle-alert.svg'),
  'circle-alert': require('../../../assets/images/feather/circle-alert.svg'),
  'chapters': require('../../../assets/images/feather/chapters.svg'),
  'studio': require('../../../assets/images/feather/studio.svg'),
  'overview': require('../../../assets/images/feather/overview.svg'),
  'moderation': require('../../../assets/images/feather/moderation.svg'),
  'captions': require('../../../assets/images/feather/captions.svg'),
  'config': require('../../../assets/images/feather/config.svg'),
  'award': require('../../../assets/images/feather/award.svg'),
  'bell': require('../../../assets/images/tabler/bell.svg'),
  'opened-bell': require('../../../assets/images/feather/opened-bell.svg'),
  'channel': require('../../../assets/images/feather/channel.svg'),
  'chevrons-up': require('../../../assets/images/feather/chevrons-up.svg'),
  'chevron-up': require('../../../assets/images/feather/chevron-up.svg'),
  'chevron-down': require('../../../assets/images/feather/chevron-down.svg'),
  'chevron-left': require('../../../assets/images/tabler/chevron-left.svg'),
  'chevron-right': require('../../../assets/images/tabler/chevron-right.svg'),
  'coin': require('../../../assets/images/tabler/coin.svg'),
  'arrow-left': require('../../../assets/images/feather/arrow-left.svg'),
  'arrow-down': require('../../../assets/images/feather/arrow-down.svg'),
  'arrow-up': require('../../../assets/images/feather/arrow-up.svg'),
  'circle-tick': require('../../../assets/images/feather/check-circle.svg'),
  'clock-arrow-down': require('../../../assets/images/feather/clock-arrow-down.svg'),
  'clock': require('../../../assets/images/tabler/clock.svg'),
  'cloud-download': require('../../../assets/images/feather/cloud-download.svg'),
  'cloud-error': require('../../../assets/images/feather/cloud-off.svg'),
  'codesandbox': require('../../../assets/images/feather/codesandbox.svg'),
  'cog': require('../../../assets/images/feather/cog.svg'),
  'columns': require('../../../assets/images/feather/columns.svg'),
  'keyboard': require('../../../assets/images/tabler/keyboard.svg'),
  'copy': require('../../../assets/images/feather/copy.svg'),
  'cross': require('../../../assets/images/feather/x.svg'),
  'delete': require('../../../assets/images/feather/delete.svg'),
  'dislike': require('../../../assets/images/feather/dislike.svg'),
  'download': require('../../../assets/images/tabler/download.svg'),
  'edit': require('../../../assets/images/feather/edit-2.svg'),
  'eye': require('../../../assets/images/feather/eye.svg'),
  'exit-fullscreen': require('../../../assets/images/feather/minimize.svg'),
  'external-link': require('../../../assets/images/feather/external-link.svg'),
  'eye-close': require('../../../assets/images/feather/eye-off.svg'),
  'eye-open': require('../../../assets/images/feather/eye.svg'),
  'film': require('../../../assets/images/feather/film.svg'),
  'filter': require('../../../assets/images/feather/filter.svg'),
  'flag': require('../../../assets/images/feather/flag.svg'),
  'fullscreen': require('../../../assets/images/tabler/maximize.svg'),
  'globe': require('../../../assets/images/feather/globe.svg'),
  'help': require('../../../assets/images/feather/help.svg'),
  'home': require('../../../assets/images/tabler/home.svg'),
  'like': require('../../../assets/images/tabler/thumb-up.svg'),
  'thumbs-up': require('../../../assets/images/tabler/thumb-up.svg'),
  'live': require('../../../assets/images/feather/live.svg'),
  'message-circle': require('../../../assets/images/tabler/message-circle.svg'),
  'more-horizontal': require('../../../assets/images/feather/more-horizontal.svg'),
  'more-vertical': require('../../../assets/images/feather/more-vertical.svg'),
  'move-right': require('../../../assets/images/feather/move-right.svg'),
  'no': require('../../../assets/images/feather/no.svg'),
  'ownership-change': require('../../../assets/images/feather/share.svg'),
  'p2p': require('../../../assets/images/feather/airplay.svg'),
  'play': require('../../../assets/images/tabler/player-play.svg'),
  'playlists': require('../../../assets/images/feather/playlists.svg'),
  'refresh': require('../../../assets/images/tabler/refresh.svg'),
  'refresh-cw': require('../../../assets/images/tabler/refresh.svg'),
  'loader': require('../../../assets/images/feather/refresh-cw.svg'),
  'repeat': require('../../../assets/images/feather/repeat.svg'),
  'search': require('../../../assets/images/tabler/search.svg'),
  'share': require('../../../assets/images/tabler/share-3.svg'),
  'star': require('../../../assets/images/tabler/star.svg'),
  'shield': require('../../../assets/images/misc/shield.svg'),
  'sign-in': require('../../../assets/images/feather/log-in.svg'),
  'sign-out': require('../../../assets/images/feather/log-out.svg'),
  'stats': require('../../../assets/images/feather/stats.svg'),
  'syndication': require('../../../assets/images/feather/syndication.svg'),
  'tick': require('../../../assets/images/feather/check.svg'),
  'trending': require('../../../assets/images/feather/trending.svg'),
  'undo': require('../../../assets/images/feather/undo.svg'),
  'upload': require('../../../assets/images/tabler/upload.svg'),
  'volume-2': require('../../../assets/images/tabler/volume.svg'),
  'user-add': require('../../../assets/images/feather/user-plus.svg'),
  'user-x': require('../../../assets/images/feather/user-x.svg'),
  'user': require('../../../assets/images/tabler/user.svg'),
  'grip-horizontal': require('../../../assets/images/feather/grip-horizontal.svg'),
  'gamepad': require('../../../assets/images/tabler/device-gamepad-2.svg'),
  'calendar': require('../../../assets/images/tabler/calendar.svg'),
  'users': require('../../../assets/images/tabler/users.svg')
}

export type GlobalIconName = keyof typeof icons

@Component({
  selector: 'my-global-icon',
  template: '',
  styleUrls: [ './common-icon.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class GlobalIconComponent implements OnInit {
  private el = inject(ElementRef)
  private hooks = inject(HooksService)

  readonly iconName = input.required<GlobalIconName>()

  async ngOnInit () {
    const nativeElement = this.el.nativeElement as HTMLElement

    nativeElement.innerHTML = await this.hooks.wrapFun(
      this.getSVGContent.bind(this),
      { name: this.iconName() },
      'common',
      'filter:internal.common.svg-icons.get-content.params',
      'filter:internal.common.svg-icons.get-content.result'
    )
    nativeElement.ariaHidden = 'true'
  }

  private getSVGContent (options: { name: GlobalIconName }) {
    return icons[options.name]
  }
}
