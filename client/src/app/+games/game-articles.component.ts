import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink } from '@angular/router'
import { HttpClient } from '@angular/common/http'
import { map } from 'rxjs/operators'
import { environment } from '../../environments/environment'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { createAsyncState } from './shared'

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
  styleUrl: './game-articles.component.scss'
})
export class GameArticlesComponent implements OnInit {
  private readonly http = inject(HttpClient)
  readonly articlesState = createAsyncState<GameArticle[]>()
  /** 模板兼容：直接返回 data，空数组兜底 */
  readonly articles = computed(() => this.articlesState.data() ?? [])
  /** 模板兼容：底层 state 的 loading 别名 */
  readonly loading = this.articlesState.loading

  ngOnInit () {
    const data$ = this.http.get<{ total: number; data: GameArticle[] }>(`${environment.apiUrl}/api/v1/games/articles`).pipe(
      map(result => result.data)
    )
    this.articlesState.load(data$)
  }

  formatNumber (num: number): string {
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return String(num)
  }
}