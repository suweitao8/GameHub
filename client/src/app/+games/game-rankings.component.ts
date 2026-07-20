import { Component, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterModule } from '@angular/router'
import type { GameRanking } from '../games.service'
import { GamesService } from '../games.service'

@Component({
  selector: 'my-game-rankings',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="rankings-container">
      <div class="rankings-header">
        <h2>游戏排行</h2>
        <div class="rankings-tabs">
          @for (tab of tabs; track tab.id) {
            <button [class.active]="currentTab() === tab.id" (click)="setTab(tab.id)">{{ tab.label }}</button>
          }
        </div>
      </div>

      <div class="rankings-list">
        @for (game of rankings(); track game.uuid; let i = $index) {
          <a class="ranking-item" [routerLink]="['/games', game.uuid]">
            <span class="rank-number" [class.top3]="i < 3">{{ i + 1 }}</span>
            <div class="ranking-cover">
              @if (game.coverPath) {
                <img [src]="game.coverPath" [alt]="game.title" loading="lazy">
              } @else {
                <div class="cover-placeholder">{{ game.title.charAt(0).toUpperCase() }}</div>
              }
            </div>
            <div class="ranking-info">
              <h3 class="ranking-title">{{ game.title }}</h3>
              <div class="ranking-stats">
                <span>{{ formatNumber(game.stats.plays) }} 游玩</span>
                <span>{{ formatNumber(game.stats.likes) }} 点赞</span>
                <span>{{ formatNumber(game.stats.favorites) }} 收藏</span>
              </div>
            </div>
            <div class="ranking-score">
              <span class="score-value">{{ formatNumber(game.stats.plays) }}</span>
              <span class="score-label">热度</span>
            </div>
          </a>
        } @empty {
          @if (!loading()) {
            <div class="rankings-empty">
              <span>暂无数据</span>
            </div>
          }
        }
      </div>

      @if (loading()) {
        <div class="rankings-loading">
          @for (i of [1,2,3,4,5,6,7,8,9,10]; track $index) {
            <div class="ranking-skeleton"><div class="skeleton-rank"></div><div class="skeleton-cover"></div><div class="skeleton-text"></div></div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .rankings-container { max-width: 900px; margin: 0 auto; padding: 1rem; }

    .rankings-header { margin-bottom: 1rem; }
    .rankings-header h2 { font-size: 1.4rem; margin-bottom: 0.75rem; }

    .rankings-tabs {
      display: flex;
      gap: 0.25rem;
      border-bottom: 1px solid var(--game-border);
      overflow-x: auto;
    }

    .rankings-tabs button {
      padding: 0.5rem 0.85rem;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      font-size: 0.85rem;
      color: var(--game-muted);
      transition: all 0.2s;
      white-space: nowrap;
    }

    .rankings-tabs button.active {
      color: var(--game-brand);
      border-bottom-color: var(--game-brand);
    }

    .rankings-list { display: flex; flex-direction: column; gap: 0.5rem; }

    .ranking-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: var(--game-radius);
      background: var(--game-surface);
      border: 1px solid var(--game-border);
      text-decoration: none;
      color: inherit;
      transition: all 0.2s;
    }

    .ranking-item:hover {
      border-color: var(--game-brand);
      transform: translateX(2px);
    }

    .rank-number {
      width: 1.75rem;
      height: 1.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--game-muted);
      background: var(--game-border);
      flex-shrink: 0;
    }

    .rank-number.top3 {
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      color: #fff;
    }

    .ranking-cover {
      width: 4rem;
      height: 4rem;
      border-radius: 6px;
      overflow: hidden;
      flex-shrink: 0;
    }

    .ranking-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .cover-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--game-brand), #34d399);
      color: #fff;
      font-size: 1.25rem;
      font-weight: 700;
    }

    .ranking-info { flex: 1; min-width: 0; }
    .ranking-title { font-size: 0.95rem; font-weight: 600; margin: 0 0 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .ranking-stats {
      display: flex;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: var(--game-muted);
    }

    .ranking-score {
      text-align: right;
      flex-shrink: 0;
    }

    .score-value { font-size: 1.1rem; font-weight: 700; color: var(--game-brand); display: block; }
    .score-label { font-size: 0.7rem; color: var(--game-muted); }

    .rankings-empty {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--game-muted);
    }

    .rankings-loading { display: flex; flex-direction: column; gap: 0.5rem; }

    .ranking-skeleton {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: var(--game-radius);
      background: var(--game-surface);
      border: 1px solid var(--game-border);
    }

    .skeleton-rank {
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 4px;
      background: var(--game-border);
      animation: pulse 1.5s infinite;
    }

    .skeleton-cover {
      width: 4rem;
      height: 4rem;
      border-radius: 6px;
      background: var(--game-border);
      animation: pulse 1.5s infinite;
    }

    .skeleton-text {
      flex: 1;
      height: 1rem;
      border-radius: 4px;
      background: var(--game-border);
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `]
})
export class GameRankingsComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  rankings = signal<GameRanking[]>([])
  currentTab = signal<'hot' | 'newest' | 'topRated' | 'favorites' | 'coins' | 'comments' | 'likes'>('hot')
  loading = signal(false)

  tabs: { id: typeof this.currentTab extends ReturnType<typeof signal<infer T>> ? T : never; label: string }[] = [
    { id: 'hot', label: '最热' },
    { id: 'newest', label: '最新' },
    { id: 'topRated', label: '评分最高' },
    { id: 'favorites', label: '最多收藏' },
    { id: 'coins', label: '最多投币' },
    { id: 'comments', label: '最多评论' },
    { id: 'likes', label: '最多点赞' }
  ]

  ngOnInit () {
    this.loadRankings()
  }

  setTab (tab: typeof this.currentTab extends ReturnType<typeof signal<infer T>> ? T : never) {
    this.currentTab.set(tab)
    this.rankings.set([])
    this.loadRankings()
  }

  loadRankings () {
    this.loading.set(true)
    this.gamesService.getRankings(this.currentTab(), 50).subscribe({
      next: (result) => {
        this.rankings.set(result.data)
        this.loading.set(false)
      },
      error: () => this.loading.set(false)
    })
  }

  formatNumber (num: number): string {
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return String(num)
  }
}
