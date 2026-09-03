import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterModule } from '@angular/router'
import type { GameRanking } from './games.service'
import { GamesService } from './games.service'
import { buildGameCoverDataUrl } from '../shared/game-cover'
import { createAsyncState } from './shared'
import { map } from 'rxjs/operators'

@Component({
  selector: 'my-game-rankings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ CommonModule, RouterModule ],
  template: `
    <div class="rankings-container">
      <div class="rankings-header">
        <h2>游戏排行</h2>
        <div class="rankings-filters">
          <div class="rankings-tabs">
            @for (tab of tabs; track tab.id) {
              <button type="button" [class.active]="currentTab() === tab.id" (click)="setTab(tab.id)">{{ tab.label }}</button>
            }
          </div>
          <div class="rankings-category-filter">
            <select [value]="selectedCategory()" (change)="setCategory($any($event.target).value)">
              <option value="">全部分类</option>
              @for (cat of categories; track cat.id) {
                <option [value]="cat.id">{{ cat.label }}</option>
              }
            </select>
          </div>
        </div>
      </div>

      <div class="rankings-list">
        @for (game of rankings(); track game.uuid; let i = $index) {
          <a class="ranking-item" [routerLink]="['/games', game.uuid]">
            <span class="rank-number" [class.top3]="i < 3">{{ i + 1 }}</span>
            <div class="ranking-cover">
              <img [src]="coverUrl(game)" [alt]="game.title + ' 封面'" loading="lazy" (error)="onCoverError(game)">
            </div>
            <div class="ranking-info">
              <h3 class="ranking-title">{{ game.title }}</h3>
              <div class="ranking-stats">
                <span>{{ formatNumber(game.stats.plays) }} 游玩</span>
                <span>{{ formatNumber(game.stats.comments) }} 评论</span>
              </div>
            </div>
            <div class="ranking-score">
              <span class="score-value">{{ getScoreDisplay(game) }}</span>
              <span class="score-label">{{ getScoreLabel() }}</span>
            </div>
          </a>
        } @empty {
          @if (hasError()) {
            <div class="rankings-error">
              <span>加载失败</span>
              <p>{{ rankingsState.error() || '数据加载失败，请稍后重试' }}</p>
              <button type="button" (click)="loadRankings()">重试</button>
            </div>
          } @else if (!loading()) {
            <div class="rankings-empty">
              <span>暂无数据</span>
            </div>
          }
        }
      </div>

      @if (loading()) {
        <div class="rankings-loading">
          @for (i of [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]; track $index) {
            <div class="ranking-skeleton">
              <div class="skeleton-rank"></div>
              <div class="skeleton-cover"></div>
              <div class="skeleton-text">
                <div class="skeleton-text-line"></div>
                <div class="skeleton-text-line short"></div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './game-rankings.component.scss'
})
export class GameRankingsComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  rankingsState = createAsyncState<GameRanking[]>([])
  /** 模板兼容 */
  rankings = computed(() => this.rankingsState.data() ?? [])
  loading = this.rankingsState.loading
  hasError = this.rankingsState.hasError
  currentTab = signal<'hot' | 'newest' | 'updated' | 'favorites' | 'coins' | 'comments' | 'likes'>('hot')
  selectedCategory = signal<string>('')
  readonly rankingCoverFallbacks = signal<Record<string, true>>({})

  tabs: { id: 'hot' | 'newest' | 'updated' | 'favorites' | 'coins' | 'comments' | 'likes'; label: string }[] = [
    { id: 'hot', label: '最热' },
    { id: 'newest', label: '最新' },
    { id: 'updated', label: '最近更新' },
    { id: 'favorites', label: '最多收藏' },
    { id: 'coins', label: '最多投币' },
    { id: 'comments', label: '最多评论' },
    { id: 'likes', label: '最多点赞' }
  ]

  categories = [
    { id: '', label: '全部' },
    { id: 'arcade', label: '动作' },
    { id: 'adventure', label: '冒险' },
    { id: 'shooter', label: '射击' },
    { id: 'puzzle', label: '解谜' },
    { id: 'casual', label: '休闲' },
    { id: 'rpg', label: '角色扮演' },
    { id: 'strategy', label: '策略' },
    { id: 'simulation', label: '模拟' },
    { id: 'sandbox', label: '沙盒' },
    { id: 'racing', label: '竞速' },
    { id: 'sports', label: '体育' },
    { id: 'card', label: '卡牌' },
    { id: 'music', label: '音乐' },
    { id: 'horror', label: '恐怖' },
    { id: 'board', label: '桌游' }
  ]

  ngOnInit () {
    this.loadRankings()
  }

  setTab (tab: 'hot' | 'newest' | 'updated' | 'favorites' | 'coins' | 'comments' | 'likes') {
    this.currentTab.set(tab)
    this.rankingsState.reset()
    this.loadRankings()
  }

  setCategory (category: string) {
    this.selectedCategory.set(category)
    this.rankingsState.reset()
    this.loadRankings()
  }

  loadRankings () {
    this.rankingsState.load(
      this.gamesService.getRankings(this.currentTab(), 50, this.selectedCategory() || undefined)
        .pipe(map(res => res.data))
    )
  }

  coverUrl (game: GameRanking) {
    if (game.coverPath && !this.rankingCoverFallbacks()[game.uuid]) return game.coverPath
    return buildGameCoverDataUrl(game.title, game.category)
  }

  onCoverError (game: GameRanking) {
    if (!game.coverPath || this.rankingCoverFallbacks()[game.uuid]) return
    this.rankingCoverFallbacks.update(state => ({ ...state, [game.uuid]: true }))
  }

  getScoreDisplay (game: GameRanking): string {
    switch (this.currentTab()) {
      case 'hot': return this.formatNumber(game.stats.plays)
      case 'newest': return this.formatNumber(game.stats.plays)
      case 'favorites': return this.formatNumber(game.stats.favorites)
      case 'coins': return this.formatNumber(game.stats.coins)
      case 'comments': return this.formatNumber(game.stats.comments)
      case 'likes': return this.formatNumber(game.stats.likes)
      default: return this.formatNumber(game.stats.plays)
    }
  }

  getScoreLabel (): string {
    const labels: Record<string, string> = {
      hot: '热度',
      newest: '游玩',
      favorites: '收藏',
      coins: '投币',
      comments: '评论',
      likes: '点赞'
    }
    return labels[this.currentTab()] || '热度'
  }

  formatNumber (num: number): string {
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return String(num)
  }
}
