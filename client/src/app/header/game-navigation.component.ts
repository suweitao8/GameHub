import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { HttpClient } from '@angular/common/http'
import { environment } from '../../environments/environment'

@Component({
  selector: 'my-game-navigation',
  templateUrl: './game-navigation.component.html',
  styleUrl: './game-navigation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ FormsModule, GlobalIconComponent ]
})
export class GameNavigationComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router)
  private readonly http = inject(HttpClient)
  private readonly historyStorageKey = 'gamehub-search-history'
  private blurTimer: ReturnType<typeof setTimeout> | undefined
  private hotRefreshTimer: ReturnType<typeof setInterval> | undefined
  private suggestionTimer: ReturnType<typeof setTimeout> | undefined
  private suggestionGeneration = 0
  readonly query = signal('')
  readonly focused = signal(false)
  readonly history = signal<string[]>([])
  readonly hotKeywords = signal<string[]>([ '像素冒险', '解谜小游戏', '平台跳跃', '休闲益智', '策略挑战', '恐怖探索', '经典街机', '独立新作', '新作推荐' ])
  readonly suggestions = signal<string[]>([])
  readonly suggestionLoading = signal(false)
  readonly suggestionVisible = signal(false)

  private readonly allHotKeywords = [
    '像素冒险', '解谜小游戏', '平台跳跃', '休闲益智',
    '策略挑战', '恐怖探索', '经典街机', '独立新作', '新作推荐',
    '物理模拟', '创意玩法', '沙盒创造', '机车竞速', '跑酷',
    '角色扮演', '塔防御策略', '音乐节奏', '文字冒险'
  ]

  ngOnInit () {
    const history = this.readHistory()
    this.history.set(history)
    this.query.set(history[0] || '')

    // Cycle hot keywords every 8 seconds
    this.hotRefreshTimer = setInterval(() => this.cycleHotKeywords(), 8000)
  }

  ngOnDestroy () {
    if (this.blurTimer) clearTimeout(this.blurTimer)
    if (this.hotRefreshTimer) clearInterval(this.hotRefreshTimer)
    if (this.suggestionTimer) clearTimeout(this.suggestionTimer)
    this.suggestionGeneration += 1
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
    this.submitSearch(new Event('submit'))
  }

  onQueryChange (value: string) {
    this.query.set(value)
    if (this.suggestionTimer) clearTimeout(this.suggestionTimer)
    const generation = ++this.suggestionGeneration
    const trimmed = value.trim()
    if (trimmed.length < 2) {
      this.suggestions.set([])
      this.suggestionLoading.set(false)
      this.suggestionVisible.set(false)
      return
    }
    this.suggestionVisible.set(false)
    this.suggestionTimer = setTimeout(() => {
      this.suggestionTimer = undefined
      this.fetchSuggestions(trimmed, generation)
    }, 150)
  }

  onKeydown (event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      // If suggestions are visible, pick the first one; otherwise submit search
      const suggestionList = this.suggestions()
      if (this.suggestionVisible() && suggestionList.length > 0) {
        this.selectSearch(suggestionList[0])
        return
      }
      this.submitSearch(event)
    }
  }

  private fetchSuggestions (query: string, generation: number) {
    if (!query) return
    if (generation !== this.suggestionGeneration) return
    this.suggestionLoading.set(true)
    this.http.get<{ data: string[] }>(`${environment.apiUrl}/api/v1/games/suggest?q=${encodeURIComponent(query)}`)
      .subscribe({
        next: result => {
          if (generation !== this.suggestionGeneration) return
          this.suggestions.set(result.data.slice(0, 8))
          this.suggestionVisible.set(result.data.length > 0)
          this.suggestionLoading.set(false)
        },
        error: () => {
          if (generation !== this.suggestionGeneration) return
          this.suggestions.set([])
          this.suggestionVisible.set(false)
          this.suggestionLoading.set(false)
        }
      })
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
    this.suggestionVisible.set(false)
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

  private cycleHotKeywords () {
    const current = this.hotKeywords()
    const shuffled = [ ...this.allHotKeywords ].sort(() => Math.random() - 0.5).slice(0, 10)
    this.hotKeywords.set(shuffled.length ? shuffled : current)
  }
}
