import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterModule } from '@angular/router'
import { map } from 'rxjs/operators'
import { GamesService } from './games.service'
import { createAsyncState } from './shared'

export type GameCollection = {
  id: number
  title: string
  description: string | null
  slug: string
  coverPath: string | null
  gameCount: number
}

@Component({
  selector: 'my-game-collections',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="collections-container">
      <div class="collections-header">
        <h2>专题合集</h2>
        <p>按主题发现精彩游戏</p>
      </div>

      @if (loading()) {
        <div class="collections-skeleton-grid">
          @for (i of [1,2,3]; track $index) {
            <div class="collection-skeleton-card shimmer">
              <div class="collection-skeleton-cover shimmer"></div>
              <div class="collection-skeleton-text shimmer"></div>
              <div class="collection-skeleton-text short shimmer"></div>
            </div>
          }
        </div>
      } @else if (error()) {
        <div class="collections-error">
          <span>加载失败</span>
          <p>专题数据加载失败，请稍后重试</p>
          <button type="button" (click)="loadCollections()">重新加载</button>
        </div>
      } @else {
        <div class="collections-grid">
          @for (collection of collections(); track collection.id) {
            <a class="collection-card" [routerLink]="['/games/collection', collection.slug]">
              @if (collection.coverPath) {
                <div class="collection-cover">
                  <img [src]="collection.coverPath" [alt]="collection.title" loading="lazy">
                </div>
              } @else {
                <div class="collection-cover-placeholder">
                  <span>{{ collection.title.charAt(0).toUpperCase() }}</span>
                </div>
              }
              <div class="collection-info">
                <h3>{{ collection.title }}</h3>
                @if (collection.description) {
                  <p>{{ collection.description }}</p>
                }
                <span class="collection-count">{{ collection.gameCount }} 个游戏</span>
              </div>
            </a>
          } @empty {
            <div class="collections-empty">
              <span>暂无专题合集</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './game-collections.component.scss'
})
export class GameCollectionsComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  private readonly state = createAsyncState<GameCollection[]>([])
  /** 模板兼容 */
  readonly collections = computed(() => this.state.data() ?? [])
  readonly loading = this.state.loading
  readonly error = this.state.hasError

  ngOnInit () {
    this.loadCollections()
  }

  loadCollections () {
    this.state.load(
      this.gamesService.listCollections()
        .pipe(map(result => result.data as unknown as GameCollection[]))
    )
  }
}
