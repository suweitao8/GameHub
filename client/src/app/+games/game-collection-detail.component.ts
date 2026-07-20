import { Component, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ActivatedRoute, RouterModule } from '@angular/router'
import { HttpClient } from '@angular/common/http'
import { environment } from '../../environments/environment'
import { GameCardComponent } from './game-card.component'
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
  imports: [CommonModule, RouterModule, GameCardComponent],
  template: `
    <div class="collection-detail-container">
      @if (collection(); as c) {
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
          <div class="game-grid">
            @for (game of c.data; track game.uuid) {
              <my-game-card [game]="game" />
            }
          </div>
        </div>
      } @else if (loading()) {
        <div class="collection-skeleton">
          <div class="skeleton-cover shimmer"></div>
          <div class="skeleton-text shimmer"></div>
        </div>
      } @else {
        <div class="collection-not-found">
          <span>专题合集不存在</span>
          <a routerLink="/games/collections">返回专题列表</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .collection-detail-container { max-width: 1200px; margin: 0 auto; padding: 1rem; }

    .collection-header { margin-bottom: 1.5rem; }
    .collection-cover { width: 100%; aspect-ratio: 16 / 9; border-radius: var(--game-radius); overflow: hidden; margin-bottom: 0.75rem; }
    .collection-cover img { width: 100%; height: 100%; object-fit: cover; }

    .collection-info h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .collection-info p { color: var(--game-muted); font-size: 0.9rem; margin: 0 0 0.5rem; }
    .collection-info span { font-size: 0.8rem; color: var(--game-muted); }

    .collection-games .game-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }

    .collection-skeleton { display: flex; flex-direction: column; gap: 1rem; }
    .skeleton-cover { width: 100%; aspect-ratio: 16 / 9; border-radius: var(--game-radius); background: var(--game-border); }
    .skeleton-text { height: 1.5rem; width: 60%; border-radius: 4px; background: var(--game-border); }

    .collection-not-found { text-align: center; padding: 3rem; }
    .collection-not-found span { display: block; font-size: 1.1rem; margin-bottom: 1rem; color: var(--game-muted); }
    .collection-not-found a { color: var(--game-brand); text-decoration: none; }
    .collection-not-found a:hover { text-decoration: underline; }
  `]
})
export class GameCollectionDetailComponent implements OnInit {
  private readonly http = inject(HttpClient)
  private readonly route = inject(ActivatedRoute)
  collection = signal<GameCollectionDetail | null>(null)
  loading = signal(false)

  ngOnInit () {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug')
      if (!slug) return
      this.loading.set(true)
      this.http.get<GameCollectionDetail>(`${environment.apiUrl}/api/v1/games/collections/${slug}`).subscribe({
        next: (result) => {
          this.collection.set(result)
          this.loading.set(false)
        },
        error: () => this.loading.set(false)
      })
    })
  }
}
