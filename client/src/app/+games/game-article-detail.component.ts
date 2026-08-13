import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { tap } from 'rxjs/operators'
import { AuthService } from '@app/core/auth/auth.service'
import { UserRole } from '@peertube/peertube-models'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { GamesService, type GameArticleDetail } from './games.service'
import { createAsyncState } from './shared'

@Component({
  selector: 'my-game-article-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ CommonModule, RouterLink, GlobalIconComponent ],
  template: `
    <main class="article-detail-container">
      @if (loading()) {
        <section class="article-detail-skeleton">
          <div class="article-skeleton-title shimmer"></div>
          <div class="article-skeleton-meta shimmer"></div>
          <div class="article-skeleton-content shimmer"></div>
        </section>
      } @else if (error()) {
        <section class="article-state" role="alert">
          <h1>文章加载失败</h1>
          <p>请稍后重试。</p>
          <button type="button" (click)="retryLoad()">重新加载</button>
        </section>
      } @else if (article(); as value) {
        <article class="article-detail-card">
          @if (value.coverPath) {
            <img class="article-detail-cover" [src]="value.coverPath" [alt]="value.title">
          }
          <header class="article-detail-header">
            <a routerLink="/games/articles" class="article-back">← 返回攻略与专栏</a>
            <span class="article-category">{{ value.category }}</span>
            <h1>{{ value.title }}</h1>
            <p class="article-summary">{{ value.summary }}</p>
            <div class="article-meta">
              @if (value.createdBy) {
                <a [routerLink]="['/games/author', value.createdBy.id]">{{ value.createdBy.displayName }}</a>
              }
              <span>{{ (value.publishedAt || value.createdAt) | date:'yyyy-MM-dd HH:mm' }}</span>
              <span><my-global-icon iconName="eye" />{{ formatNumber(viewCount()) }} 阅读</span>
            </div>
          </header>
          <div class="article-content">{{ value.content }}</div>
          @if (canEdit(value)) {
            <footer class="article-detail-actions">
              <a class="article-edit-button" [routerLink]="['/games/articles', value.slug, 'edit']">编辑文章</a>
              <button type="button" class="article-delete-button" [disabled]="deleting()" (click)="deleteArticle()">
                {{ deleting() ? '删除中…' : deleteConfirmation() ? '确认删除' : '删除文章' }}
              </button>
              @if (deleteConfirmation() && !deleting()) {
                <button type="button" class="article-cancel-delete" (click)="deleteConfirmation.set(false)">取消</button>
              }
            </footer>
          }
        </article>
      } @else {
        <section class="article-state"><h1>文章不存在</h1><a routerLink="/games/articles">返回攻略与专栏</a></section>
      }
    </main>
  `,
  styleUrl: './game-article-detail.component.scss'
})
export class GameArticleDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly gamesService = inject(GamesService)
  private readonly authService = inject(AuthService)
  private readonly destroyRef = inject(DestroyRef)
  private currentSlug = ''

  readonly state = createAsyncState<GameArticleDetail>()
  readonly article = computed(() => this.state.data())
  readonly loading = this.state.loading
  readonly error = this.state.hasError
  readonly viewCount = signal(0)
  readonly deleting = signal(false)
  readonly deleteConfirmation = signal(false)

  ngOnInit () {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const slug = params.get('slug')
        if (!slug) return
        this.currentSlug = slug
        this.viewCount.set(0)
        this.loadArticle(slug)
      })
  }

  retryLoad () {
    if (this.currentSlug) this.loadArticle(this.currentSlug)
  }

  canEdit (article: GameArticleDetail) {
    const user = this.authService.getUser()
    return user?.account?.id === article.createdBy?.id ||
      user?.role.id === UserRole.ADMINISTRATOR || user?.role.id === UserRole.MODERATOR
  }

  deleteArticle () {
    const value = this.article()
    if (!value || this.deleting()) return
    if (!this.deleteConfirmation()) {
      this.deleteConfirmation.set(true)
      return
    }

    this.deleting.set(true)
    this.gamesService.deleteArticle(value.slug).subscribe({
      next: () => { this.router.navigate([ '/games/articles' ]) },
      error: () => {
        this.deleting.set(false)
        this.deleteConfirmation.set(false)
      }
    })
  }

  formatNumber (value: number) {
    if (value >= 10000) return `${(value / 10000).toFixed(1)}w`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
    return String(value)
  }

  private loadArticle (slug: string) {
    this.state.load(this.gamesService.getArticle(slug).pipe(
      tap(article => {
        if (this.currentSlug !== slug) return
        this.viewCount.set(article.viewCount)
        this.recordView(slug)
      })
    ))
  }

  private recordView (slug: string) {
    this.gamesService.recordArticleView(slug).subscribe({
      next: result => {
        if (this.currentSlug === slug) this.viewCount.set(result.viewCount)
      },
      error: () => undefined
    })
  }
}
