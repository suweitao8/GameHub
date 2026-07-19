import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { getGameActionErrorMessage } from './game-action-feedback'
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
  readonly feedback = signal('')
  readonly loading = signal(true)
  readonly moderating = signal<string | null>(null)
  readonly removeTarget = signal<string | null>(null)
  readonly removing = signal<string | null>(null)
  readonly ownerView = signal(false)

  ngOnInit () {
    this.gamesService.listForModerators().subscribe({
      next: result => { this.games.set(result.data); this.loading.set(false) },
      error: () => this.gamesService.listOwned().subscribe({
        next: result => { this.games.set(result.data); this.ownerView.set(true); this.loading.set(false) },
        error: () => { this.error.set('只有管理员、审核员或游戏作者可以查看这里。'); this.loading.set(false) }
      })
    })
  }

  moderate (game: Game, action: 'approve' | 'reject' | 'unlist' | 'block') {
    const actionKey = `${game.uuid}:${action}`
    if (this.moderating()) return
    this.error.set('')
    this.feedback.set('')
    this.moderating.set(actionKey)
    this.gamesService.moderate(game.uuid, action).subscribe({
      next: updated => {
        this.games.update(items => items.map(item => item.uuid === updated.uuid ? updated : item))
        this.feedback.set({ approve: '游戏已发布。', reject: '游戏已退回。', unlist: '游戏已下架。', block: '游戏已封禁。' }[action])
        this.moderating.set(null)
      },
      error: error => {
        this.error.set(getGameActionErrorMessage(error))
        this.moderating.set(null)
      }
    })
  }

  isModerating (game: Game, action: 'approve' | 'reject' | 'unlist' | 'block') {
    return this.moderating() === `${game.uuid}:${action}`
  }

  requestRemove (game: Game) {
    if (!this.ownerView() || this.removing() || this.moderating()) return
    if (this.removeTarget() !== game.uuid) {
      this.removeTarget.set(game.uuid)
      return
    }

    this.removeTarget.set(null)
    this.removing.set(game.uuid)
    this.error.set('')
    this.feedback.set('')
    this.gamesService.remove(game.uuid).subscribe({
      next: () => {
        this.games.update(items => items.filter(item => item.uuid !== game.uuid))
        this.feedback.set('游戏已下架，可在管理员审核后重新发布。')
        this.removing.set(null)
      },
      error: error => {
        this.error.set(getGameActionErrorMessage(error))
        this.removing.set(null)
      }
    })
  }

  isRemoving (game: Game) {
    return this.removing() === game.uuid
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
