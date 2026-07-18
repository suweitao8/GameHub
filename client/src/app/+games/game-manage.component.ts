import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { GamesService, Game } from './games.service'

@Component({
  templateUrl: './game-manage.component.html',
  styleUrl: './game-manage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink ]
})
export class GameManageComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  readonly games = signal<Game[]>([])
  readonly error = signal('')
  readonly ownerView = signal(false)

  ngOnInit () {
    this.gamesService.listForModerators().subscribe({
      next: result => this.games.set(result.data),
      error: () => this.gamesService.listOwned().subscribe({
        next: result => { this.games.set(result.data); this.ownerView.set(true) },
        error: () => this.error.set('只有管理员、审核员或游戏作者可以查看这里。')
      })
    })
  }

  moderate (game: Game, action: 'approve' | 'reject' | 'unlist' | 'block') {
    this.gamesService.moderate(game.uuid, action).subscribe({
      next: updated => this.games.update(items => items.map(item => item.uuid === updated.uuid ? updated : item))
    })
  }

  statusLabel (status: Game['status']) {
    return {
      pending: '待审核',
      published: '已发布',
      rejected: '已退回',
      unlisted: '已下架',
      blocked: '已封禁'
    }[status]
  }

  getDownloadUrl (uuid: string) {
    return this.gamesService.buildDownloadUrl(uuid)
  }
}
