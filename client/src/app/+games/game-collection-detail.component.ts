import { Component, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ActivatedRoute } from '@angular/router'
import { HttpClient } from '@angular/common/http'
import { environment } from '../../environments/environment'
import { GameCardComponent } from './game-card.component'
import { GameSkeletonComponent } from './game-skeleton.component'
import type { Game } from './games.service'

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
  styles: [ `
    .collection-detail-container { max-width: 1200px; margin: 0 auto; padding: 1rem; }

    .collection-header { margin-bottom: 1.5rem; }
    .collection-cover { width: 100%; aspect-ratio: 16 / 9; border-radius: var(--game-radius); overflow: hidden; margin-bottom: 0.75rem; }
    .collection-cover img { width: 100%; height: 100%; object-fit: cover; }

    .collection-info h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .collection-info p { color: var(--game-muted); font-size: 0.9rem; margin: 0 0 0.5rem; }
    .collection-info span { font-size: 0.8rem; color: var(--game-muted); }

    .collection-games .game-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }

    .collection-skeleton-header { margin-bottom: 1.5rem; }
    .collection-skeleton-cover {
      width: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--game-radius);
      background: #e2e8f0;
      margin-bottom: 0.75rem;
    }
    .collection-skeleton-text { height: 1rem; width: 60%; border-radius: 4px; background: #e2e8f0; margin-bottom: 0.5rem; }
    .collection-skeleton-text.short { width: 30%; }
    .collection-skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }

    .collection-not-found { text-align: center; padding: 3rem; }
    .collection-not-found span { display: block; font-size: 1.1rem; color: var(--game-muted); }

    .collection-empty {
      align-items: center;
      background: #fff;
      border: 1px solid var(--game-border);
      border-radius: var(--game-radius);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      justify-content: center;
      min-height: calc(100vh - 8rem);
      padding: 3rem 1rem;
      text-align: center;
    }
    .collection-empty span { font-size: 1.1rem; color: var(--game-muted); }

    .collection-error {
      align-items: center;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      justify-content: center;
      min-height: calc(100vh - 8rem);
      padding: 3rem 1rem;
      text-align: center;
    }
    .collection-error span { font-size: 1.1rem; color: var(--game-muted); }
    .collection-error p { margin: 0; color: var(--game-muted); }
    .collection-error button {
      background: var(--game-brand);
      border: 0;
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
      font-weight: 600;
      padding: 0.55rem 1.25rem;
    }
  ` ]
})
export class GameCollectionDetailComponent implements OnInit {
  private readonly http = inject(HttpClient)
  private readonly route = inject(ActivatedRoute)
  collection = signal<GameCollectionDetail | null>(null)
  loading = signal(false)
  error = signal(false)
  private currentSlug = ''

  ngOnInit () {
    this.route.paramMap.subscribe(params => {
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
    this.loading.set(true)
    this.error.set(false)
    this.http.get<GameCollectionDetail>(`${environment.apiUrl}/api/v1/games/collections/${slug}`).subscribe({
      next: (result) => {
        this.collection.set(result)
        this.loading.set(false)
      },
      error: () => {
        this.error.set(true)
        this.loading.set(false)
      }
    })
  }
}
