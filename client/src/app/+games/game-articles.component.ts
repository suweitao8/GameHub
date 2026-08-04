import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink } from '@angular/router'
import { HttpClient } from '@angular/common/http'
import { environment } from '../../environments/environment'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

export type GameArticle = {
  id: number
  title: string
  summary: string
  slug: string
  coverPath: string | null
  author: { id: number; name: string; displayName: string; avatarUrl: string } | null
  createdAt: string
  viewCount: number
  likeCount: number
  commentCount: number
  category: string
}

@Component({
  selector: 'my-game-articles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, GlobalIconComponent],
  template: `
    <div class="articles-container">
      <div class="articles-header">
        <h2>攻略与专栏</h2>
        <p>玩家创作的游戏攻略、评测和心得分享</p>
      </div>

      @if (loading()) {
        <div class="articles-grid">
          @for (i of [1,2,3,4,5,6]; track $index) {
            <div class="article-card-skeleton shimmer"></div>
          }
        </div>
      } @else if (articles().length) {
        <div class="articles-grid">
          @for (article of articles(); track article.id) {
            <a class="article-card" [routerLink]="['/games/article', article.slug]">
              <div class="article-cover">
                @if (article.coverPath) {
                  <img [src]="article.coverPath" [alt]="article.title" loading="lazy">
                } @else {
                  <div class="article-cover-placeholder">{{ article.title.charAt(0) }}</div>
                }
              </div>
              <div class="article-info">
                <h3>{{ article.title }}</h3>
                <p>{{ article.summary }}</p>
                <div class="article-footer">
                  <span class="article-category">{{ article.category }}</span>
                  <div class="article-stats">
                    <span><my-global-icon iconName="eye" />{{ formatNumber(article.viewCount) }}</span>
                    <span><my-global-icon iconName="like" />{{ formatNumber(article.likeCount) }}</span>
                    <span><my-global-icon iconName="message-circle" />{{ formatNumber(article.commentCount) }}</span>
                  </div>
                </div>
              </div>
            </a>
          }
        </div>
      } @else {
        <div class="articles-empty">
          <span>暂无攻略文章</span>
          <p>成为第一个分享游戏心得的玩家</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .articles-container { max-width: 1200px; margin: 0 auto; padding: 1rem; }

    .articles-header { margin-bottom: 1.5rem; }
    .articles-header h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .articles-header p { color: var(--game-muted); font-size: 0.9rem; margin: 0; }

    .articles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .article-card {
      background: #fff;
      border: 1px solid var(--game-border);
      border-radius: var(--game-radius);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
    }

    .article-card:hover {
      border-color: var(--game-brand);
      box-shadow: var(--game-shadow);
      transform: translateY(-2px);
    }

    .article-cover { width: 100%; aspect-ratio: 16 / 9; overflow: hidden; background: var(--game-surface); }
    .article-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .article-cover-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--game-brand), #34d399);
      color: #fff;
      font-size: 2.5rem;
      font-weight: 700;
    }

    .article-info { padding: 0.85rem; display: flex; flex-direction: column; flex: 1; }

    .article-info h3 { font-size: 0.95rem; margin: 0 0 0.4rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .article-info p {
      color: var(--game-muted);
      font-size: 0.8rem;
      margin: 0 0 0.75rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      flex: 1;
    }

    .article-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .article-category {
      background: var(--game-brand-soft);
      border-radius: 4px;
      color: var(--game-brand-deep);
      font-size: 0.72rem;
      padding: 0.2rem 0.5rem;
      font-weight: 600;
    }

    .article-stats {
      display: flex;
      gap: 0.6rem;
      font-size: 0.72rem;
      color: var(--game-muted);
    }

    .article-stats span { display: inline-flex; align-items: center; gap: 0.2rem; }
    .article-stats my-global-icon { height: 0.75rem; width: 0.75rem; }

    .articles-empty { text-align: center; padding: 3rem; color: var(--game-muted); }
    .articles-empty span { display: block; font-size: 1.1rem; margin-bottom: 0.5rem; }
    .articles-empty p { font-size: 0.82rem; margin: 0; }

    .articles-grid .article-card-skeleton { height: 240px; border-radius: var(--game-radius); background: var(--game-border); }
  `]
})
export class GameArticlesComponent implements OnInit {
  private readonly http = inject(HttpClient)
  articles = signal<GameArticle[]>([])
  loading = signal(false)

  ngOnInit () {
    this.loading.set(true)
    this.http.get<{ total: number; data: GameArticle[] }>(`${environment.apiUrl}/api/v1/games/articles`).subscribe({
      next: (result) => {
        this.articles.set(result.data)
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