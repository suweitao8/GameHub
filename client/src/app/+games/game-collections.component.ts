import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterModule } from '@angular/router'
import { HttpClient } from '@angular/common/http'
import { map } from 'rxjs/operators'
import { environment } from '../../environments/environment'
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
  styles: [`
    .collections-container { max-width: 1200px; margin: 0 auto; padding: 1rem; }

    .collections-header { margin-bottom: 1.5rem; }
    .collections-header h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .collections-header p { color: var(--game-muted); font-size: 0.9rem; margin: 0; }

    .collections-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .collection-card {
      display: flex;
      flex-direction: column;
      border-radius: var(--game-radius);
      background: var(--game-surface);
      border: 1px solid var(--game-border);
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s;
    }

    .collection-card:hover { border-color: var(--game-brand); transform: translateY(-2px); }

    .collection-cover { width: 100%; aspect-ratio: 16 / 9; overflow: hidden; }
    .collection-cover img { width: 100%; height: 100%; object-fit: cover; }

    .collection-cover-placeholder {
      width: 100%;
      aspect-ratio: 16 / 9;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--game-brand), #34d399);
      color: #fff;
      font-size: 2.5rem;
      font-weight: 700;
    }

    .collection-info { padding: 0.75rem; }
    .collection-info h3 { font-size: 1rem; margin: 0 0 0.25rem; }
    .collection-info p { font-size: 0.8rem; color: var(--game-muted); margin: 0 0 0.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .collection-count { font-size: 0.75rem; color: var(--game-muted); }

    .collections-empty { text-align: center; padding: 3rem; color: var(--game-muted); }

    .collections-skeleton-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .collection-skeleton-card {
      border-radius: var(--game-radius);
      border: 1px solid var(--game-border);
      overflow: hidden;
      background: var(--game-surface);
      padding-bottom: 0.75rem;
    }

    .collection-skeleton-cover {
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #e2e8f0;
    }

    .collection-skeleton-text {
      height: 0.9rem;
      background: #e2e8f0;
      border-radius: 4px;
      margin: 0.6rem 0.75rem 0;
      width: 70%;
    }

    .collection-skeleton-text.short {
      width: 40%;
    }

    .collections-error {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--game-muted);
    }

    .collections-error span { display: block; font-size: 1.1rem; margin-bottom: 0.5rem; }
    .collections-error p { margin: 0 0 1rem; }
    .collections-error button {
      background: var(--game-brand);
      border: 0;
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
      font-weight: 600;
      padding: 0.55rem 1.25rem;
    }
  `]
})
export class GameCollectionsComponent implements OnInit {
  private readonly http = inject(HttpClient)
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
      this.http.get<{ total: number; data: GameCollection[] }>(`${environment.apiUrl}/api/v1/games/collections`)
        .pipe(map(result => result.data))
    )
  }
}
