import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { GamesService, type GameArticleInput } from './games.service'
import { createAsyncState } from './shared'

@Component({
  selector: 'my-game-article-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink ],
  template: `
    <main class="article-editor-container">
      <header class="article-editor-header">
        <div>
          <p class="article-editor-eyebrow">攻略与专栏</p>
          <h1>{{ editing() ? '编辑文章' : '写一篇攻略' }}</h1>
          <p>支持纯文本排版，发布后会立即出现在攻略与专栏列表。</p>
        </div>
        <a routerLink="/games/articles">取消并返回</a>
      </header>

      @if (loading()) {
        <section class="article-editor-state">正在载入文章…</section>
      } @else {
        <form class="article-editor-form" (submit)="$event.preventDefault(); submit()">
          <label>
            标题
            <input [value]="title()" (input)="title.set($any($event.target).value)" maxlength="160" required autocomplete="off">
          </label>
          <label>
            链接标识（可选，留空将按标题自动生成）
            <input [value]="slug()" (input)="slug.set($any($event.target).value)" maxlength="160"
                   autocomplete="off" placeholder="例如：pixel-platformer-guide">
          </label>
          <div class="article-editor-row">
            <label>
              分类
              <input [value]="category()" (input)="category.set($any($event.target).value)" maxlength="64" placeholder="攻略、评测、心得…">
            </label>
            <label>
              封面地址（可选）
              <input [value]="coverPath()" (input)="coverPath.set($any($event.target).value)" maxlength="2048"
                     placeholder="/client/assets/... 或 https://...">
            </label>
          </div>
          <label>
            摘要（可选，留空将取正文开头）
            <textarea [value]="summary()" (input)="summary.set($any($event.target).value)" rows="3" maxlength="360"></textarea>
          </label>
          <label>
            正文
            <textarea class="article-content-input" [value]="content()"
                      (input)="content.set($any($event.target).value)" rows="18" maxlength="30000" required></textarea>
          </label>
          @if (feedback()) { <p class="article-editor-feedback" role="alert">{{ feedback() }}</p> }
          <footer>
            <a routerLink="/games/articles">取消</a>
            <button type="submit" [disabled]="saving()">{{ saving() ? '发布中…' : editing() ? '保存修改' : '发布文章' }}</button>
          </footer>
        </form>
      }
    </main>
  `,
  styleUrl: './game-article-editor.component.scss'
})
export class GameArticleEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly gamesService = inject(GamesService)
  private readonly destroyRef = inject(DestroyRef)
  private editingSlug = ''

  readonly state = createAsyncState<null>()
  readonly loading = this.state.loading
  readonly editing = signal(false)
  readonly saving = signal(false)
  readonly feedback = signal('')
  readonly title = signal('')
  readonly slug = signal('')
  readonly category = signal('攻略')
  readonly coverPath = signal('')
  readonly summary = signal('')
  readonly content = signal('')
  readonly canSubmit = computed(() => this.title().trim().length > 0 && this.content().trim().length > 0)

  ngOnInit () {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const slug = params.get('slug')
        if (!slug) return
        this.editing.set(true)
        this.editingSlug = slug
        this.loadArticle(slug)
      })
  }

  submit () {
    if (this.saving() || !this.canSubmit()) {
      this.feedback.set('请填写标题和正文后再发布。')
      return
    }

    const input: GameArticleInput = {
      title: this.title().trim(),
      content: this.content().trim(),
      slug: this.slug().trim() || null,
      category: this.category().trim() || null,
      coverPath: this.coverPath().trim() || null,
      summary: this.summary().trim() || null
    }

    this.saving.set(true)
    this.feedback.set('')
    const request = this.editing()
      ? this.gamesService.updateArticle(this.editingSlug, input)
      : this.gamesService.createArticle(input)
    request.subscribe({
      next: article => { this.router.navigate([ '/games/articles', article.slug ]) },
      error: error => {
        this.saving.set(false)
        this.feedback.set(error?.error?.error || '发布失败，请稍后重试。')
      }
    })
  }

  private loadArticle (slug: string) {
    this.state.loading.set(true)
    this.gamesService.getArticle(slug).subscribe({
      next: article => {
        this.title.set(article.title)
        this.slug.set(article.slug)
        this.category.set(article.category)
        this.coverPath.set(article.coverPath || '')
        this.summary.set(article.summary)
        this.content.set(article.content)
        this.state.loading.set(false)
      },
      error: () => {
        this.state.loading.set(false)
        this.feedback.set('文章加载失败，请返回列表后重试。')
      }
    })
  }
}
