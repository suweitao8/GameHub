import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { Subscription } from 'rxjs'
import { getGameActionErrorMessage } from './game-action-feedback'
import { GamesService, Game } from './games.service'

@Component({
  templateUrl: './game-manage.component.html',
  styleUrl: './game-manage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink ]
})
export class GameManageComponent implements OnInit, OnDestroy {
  private readonly gamesService = inject(GamesService)
  readonly games = signal<Game[]>([])
  readonly filteredGames = signal<Game[]>([])
  readonly error = signal('')
  readonly feedback = signal('')
  readonly loading = signal(true)
  readonly moderating = signal<string | null>(null)
  readonly removeTarget = signal<string | null>(null)
  readonly removing = signal<string | null>(null)
  readonly ownerView = signal(false)
  readonly searchQuery = signal('')
  readonly statusFilter = signal<'all' | 'pending' | 'published' | 'rejected' | 'unlisted' | 'blocked'>('all')

  readonly statusTabs = [
    { id: 'all' as const, label: '全部' },
    { id: 'pending' as const, label: '待审核' },
    { id: 'published' as const, label: '已发布' },
    { id: 'rejected' as const, label: '已退回' },
    { id: 'unlisted' as const, label: '已下架' },
    { id: 'blocked' as const, label: '已封禁' }
  ]

  ngOnInit () {
    this.gamesService.listForModerators().subscribe({
      next: result => { this.games.set(result.data); this.applyFilter(); this.loading.set(false) },
      error: () => this.gamesService.listOwned().subscribe({
        next: result => { this.games.set(result.data); this.ownerView.set(true); this.applyFilter(); this.loading.set(false) },
        error: () => { this.error.set('只有管理员、审核员或游戏作者可以查看这里。'); this.loading.set(false) }
      })
    })
  }

  ngOnDestroy () {
    // No active subscriptions to clean up in this component
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
        this.applyFilter()
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
        this.applyFilter()
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

  applyFilter () {
    const query = this.searchQuery().trim().toLowerCase()
    const status = this.statusFilter()
    this.filteredGames.set(this.games().filter(game => {
      const matchQuery = !query || game.title.toLowerCase().includes(query)
      const matchStatus = status === 'all' || game.status === status
      return matchQuery && matchStatus
    }))
  }

  setSearchQuery (value: string) {
    this.searchQuery.set(value)
    this.applyFilter()
  }

  setStatusFilter (value: 'all' | 'pending' | 'published' | 'rejected' | 'unlisted' | 'blocked') {
    this.statusFilter.set(value)
    this.applyFilter()
  }
}
