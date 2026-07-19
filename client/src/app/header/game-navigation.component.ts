import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-game-navigation',
  templateUrl: './game-navigation.component.html',
  styleUrl: './game-navigation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ FormsModule, GlobalIconComponent ]
})
export class GameNavigationComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router)
  private readonly historyStorageKey = 'gamehub-search-history'
  private blurTimer: ReturnType<typeof setTimeout> | undefined
  readonly query = signal('')
  readonly focused = signal(false)
  readonly history = signal<string[]>([])
  readonly hotKeywords = [ '像素冒险', '解谜小游戏', '平台跳跃', '双人游戏', '休闲益智', '策略挑战', '恐怖探索', '经典街机', '独立新作', '新作推荐' ]

  ngOnInit () {
    const history = this.readHistory()
    this.history.set(history)
    this.query.set(history[0] || '')
  }

  ngOnDestroy () {
    if (this.blurTimer) clearTimeout(this.blurTimer)
  }

  onFocus () {
    if (this.blurTimer) clearTimeout(this.blurTimer)
    this.focused.set(true)
  }

  onBlur () {
    this.blurTimer = setTimeout(() => this.focused.set(false), 140)
  }

  selectSearch (term: string) {
    this.query.set(term)
    this.focused.set(true)
  }

  clearHistory () {
    this.history.set([])
    this.writeHistory([])
  }

  submitSearch (event: Event) {
    event.preventDefault()
    const search = this.query().trim() || this.history()[0] || ''
    if (!search) return

    this.query.set(search)
    this.rememberSearch(search)
    this.focused.set(false)
    void this.router.navigate([ '/games/search' ], { queryParams: { search } })
  }

  private rememberSearch (term: string) {
    const next = [ term, ...this.history().filter(item => item !== term) ].slice(0, 10)
    this.history.set(next)
    this.writeHistory(next)
  }

  private readHistory () {
    if (typeof window === 'undefined') return []
    try {
      const value = JSON.parse(window.localStorage.getItem(this.historyStorageKey) || '[]')
      return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 10)
        : []
    } catch {
      return []
    }
  }

  private writeHistory (history: string[]) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(this.historyStorageKey, JSON.stringify(history))
  }
}
