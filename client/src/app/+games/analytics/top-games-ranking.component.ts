import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'

interface GameRankingItem {
  gameId: number
  title: string
  plays: number
  likes: number
  coins: number
}

@Component({
  selector: 'my-top-games-ranking',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink, GlobalIconComponent ],
  template: `
    <section class="analytics-card wide">
      <div class="card-header">
        <h3>游戏排行 Top 10</h3>
        <a routerLink="/games/rankings" class="view-more">查看完整排行 →</a>
      </div>
      <div class="ranking-list">
        @for (game of topGames(); track game.gameId; let i = $index) {
          <div class="ranking-item">
            <span class="ranking-number" [class.top3]="i < 3">{{ i + 1 }}</span>
            <span class="ranking-title">{{ game.title }}</span>
            <div class="ranking-bar-container">
              <div class="ranking-bar" [style.width.%]="(game.plays / maxPlays()) * 100"></div>
            </div>
            <div class="ranking-stats">
              <span class="stat-plays"><my-global-icon iconName="play" />{{ formatNumber(game.plays) }}</span>
              <span class="stat-likes"><my-global-icon iconName="like" />{{ formatNumber(game.likes) }}</span>
              <span class="stat-coins"><my-global-icon iconName="coin" />{{ formatNumber(game.coins) }}</span>
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: [ `
    .analytics-card {
      background: var(--game-surface);
      border: 1px solid var(--game-border);
      border-radius: var(--game-radius);
      padding: 1rem;
    }

    .analytics-card.wide { grid-column: 1 / -1; }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .card-header h3 { font-size: var(--game-font-size-lg); margin: 0; color: var(--game-text); }
    .view-more { font-size: var(--game-font-size-sm); color: var(--game-brand); text-decoration: none; }
    .view-more:hover { text-decoration: underline; }

    .ranking-list { display: flex; flex-direction: column; gap: 0.35rem; }

    .ranking-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.5rem;
      border-radius: var(--game-radius);
      background: color-mix(in srgb, var(--game-text-primary) 2%, transparent);
    }

    .ranking-number {
      width: 1.6rem;
      height: 1.6rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: var(--game-font-size-sm);
      font-weight: 700;
      background: var(--game-border);
      color: var(--game-muted);
      flex-shrink: 0;
    }

    .ranking-number.top3 { background: var(--game-warning); color: var(--game-text-inverse); }
    .ranking-title {
      color: var(--game-text);
      flex-shrink: 0;
      font-size: var(--game-font-size-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 8rem;
    }

    .ranking-bar-container {
      flex: 1;
      height: 0.4rem;
      background: var(--game-border);
      border-radius: var(--game-radius-pill);
      overflow: hidden;
    }

    .ranking-bar {
      background: var(--game-brand);
      border-radius: var(--game-radius-pill);
      height: 100%;
      transition: width 0.5s ease;
    }

    .ranking-stats {
      color: var(--game-muted);
      display: flex;
      flex-shrink: 0;
      font-size: var(--game-font-size-xs);
      gap: 0.65rem;
      justify-content: flex-end;
      width: 9rem;
    }
    .ranking-stats span { align-items: center; display: inline-flex; gap: 0.2rem; }
    .ranking-stats my-global-icon { height: 0.85rem; width: 0.85rem; }
    .ranking-stats span { white-space: nowrap; }
  ` ]
})
export class TopGamesRankingComponent {
  readonly gameRanking = input.required<GameRankingItem[]>()

  readonly maxPlays = computed(() => {
    const ranking = this.gameRanking()
    return Math.max(...ranking.map(g => g.plays), 1)
  })

  readonly topGames = computed(() => this.gameRanking().slice(0, 10))

  formatNumber (num: number): string {
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return String(num)
  }
}
