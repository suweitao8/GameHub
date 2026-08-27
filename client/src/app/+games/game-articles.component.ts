import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Router, RouterLink } from '@angular/router'
import { map } from 'rxjs/operators'
import { AuthService } from '@app/core/auth/auth.service'
import { LoginModalService } from '@app/+login/login-modal.service'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { createAsyncState } from './shared'
import { GamesService, type GameArticle } from './games.service'

@Component({
  selector: 'my-game-articles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ CommonModule, RouterLink, GlobalIconComponent ],
  template: `
    <div class="articles-container">
      <div class="articles-header">
        <div>
          <h2>攻略与专栏</h2>
          <p>玩家创作的游戏攻略、评测和心得分享</p>
        </div>
        <button type="button" class="article-create-button" (click)="startCreate()"><my-global-icon iconName="plus" />写攻略</button>
      </div>

      @if (loading()) {
        <div class="articles-grid">
          @for (i of [ 1, 2, 3, 4, 5, 6 ]; track $index) {
            <div class="article-card-skeleton shimmer"></div>
          }
        </div>
      } @else if (hasError()) {
        <div class="articles-state" role="alert">
          <span>攻略加载失败</span>
          <p>{{ error() || '请稍后重试。' }}</p>
          <button type="button" (click)="loadArticles()">重新加载</button>
        </div>
      } @else if (articles().length) {
        <div class="articles-grid">
          @for (article of articles(); track article.id) {
              <a class="article-card" [routerLink]="['/games/articles', article.slug]">
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
                    @if (article.createdBy) { <span>{{ article.createdBy.displayName }}</span> }
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
  private readonly gamesService = inject(GamesService)
  private readonly authService = inject(AuthService)
  private readonly loginModalService = inject(LoginModalService)
  private readonly router = inject(Router)
  readonly articlesState = createAsyncState<GameArticle[]>()
  /** 模板兼容：直接返回 data，空数组兜底 */
  readonly articles = computed(() => this.articlesState.data() ?? [])
  /** 模板兼容：底层 state 的 loading 别名 */
  readonly loading = this.articlesState.loading
  readonly error = this.articlesState.error
  readonly hasError = this.articlesState.hasError

  ngOnInit () {
    this.loadArticles()
  }

  loadArticles () {
    const data$ = this.gamesService.listArticles().pipe(
      map(result => result.data)
    )
    this.articlesState.load(data$)
  }

  startCreate () {
    if (!this.authService.isLoggedIn()) {
      this.loginModalService.open({ returnUrl: '/games/articles/new', inPlace: true })
      return
    }

    void this.router.navigate([ '/games/articles/new' ])
  }

  formatNumber (num: number): string {
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return String(num)
  }
}
