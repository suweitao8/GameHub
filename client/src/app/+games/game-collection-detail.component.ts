import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ActivatedRoute } from '@angular/router'
import { map } from 'rxjs/operators'
import { GameCardComponent } from './game-card.component'
import { GameSkeletonComponent } from './game-skeleton.component'
import { createAsyncState } from './shared'
import { GamesService, type Game } from './games.service'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'

export type GameCollectionDetail = {
  id: number
  title: string
  description: string | null
  slug: string
  coverPath: string | null
  total: number
  data: Game[]
}

@Component({
  selector: 'my-game-collection-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ CommonModule, GameCardComponent, GameSkeletonComponent ],
  template: `
    <div class="collection-detail-container">
      @if (loading()) {
        <div class="collection-skeleton-header">
          <div class="collection-skeleton-cover shimmer"></div>
          <div class="collection-skeleton-text shimmer"></div>
          <div class="collection-skeleton-text short shimmer"></div>
        </div>
        <div class="collection-skeleton-grid">
          @for (i of [1,2,3,4,5,6]; track $index) {
            <my-game-skeleton />
          }
        </div>
      } @else if (error()) {
        <div class="collection-error">
          <span>加载失败</span>
          <p>专题数据加载失败，请稍后重试</p>
          <button type="button" (click)="retryLoad()">重新加载</button>
        </div>
      } @else if (collection(); as c) {
        <div class="collection-header">
          @if (c.coverPath) {
            <div class="collection-cover">
              <img [src]="c.coverPath" [alt]="c.title">
            </div>
          }
          <div class="collection-info">
            <h1>{{ c.title }}</h1>
            @if (c.description) { <p>{{ c.description }}</p> }
            <span>{{ c.total }} 个游戏</span>
          </div>
        </div>

        <div class="collection-games">
          @if (c.data.length) {
            <div class="game-grid">
              @for (game of c.data; track game.uuid) {
                <my-game-card [game]="game" />
              }
            </div>
          } @else {
            <div class="collection-empty">
              <span>该专题暂无游戏</span>
            </div>
          }
        </div>
      } @else {
        <div class="collection-not-found">
          <span>专题合集不存在</span>
        </div>
      }
    </div>
  `,
  styleUrl: './game-collection-detail.component.scss'
})
export class GameCollectionDetailComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  private readonly route = inject(ActivatedRoute)
  private readonly destroyRef = inject(DestroyRef)
  private readonly state = createAsyncState<GameCollectionDetail>()
  /** 模板兼容 */
  readonly collection = this.state.data
  readonly loading = this.state.loading
  readonly error = this.state.hasError
  private currentSlug = ''

  ngOnInit () {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
      const slug = params.get('slug')
      if (!slug) return
      this.currentSlug = slug
      this.loadCollection(slug)
    })
  }

  retryLoad () {
    if (!this.currentSlug) return
    this.loadCollection(this.currentSlug)
  }

  private loadCollection (slug: string) {
    this.state.load(
      this.gamesService.getCollection(slug).pipe(map(data => data as unknown as GameCollectionDetail))
    )
  }
}
