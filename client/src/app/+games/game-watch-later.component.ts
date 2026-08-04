import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { WatchLaterService, WatchLaterItem } from './watch-later.service'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-game-watch-later',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink, GlobalIconComponent ],
  template: `
    <main class="game-community-page library-page">
      <div class="game-community-content">
        <header>
          <p class="game-eyebrow">我的游戏</p>
          <h1>稍后再玩</h1>
          <p>你标记的游戏会在这里，方便稍后回来继续。</p>
        </header>

        <div class="watch-later-list">
          @if (items().length === 0) {
            <div class="library-empty">
              <span>还没有标记游戏</span>
              <p>浏览游戏时点击「稍后再玩」，把感兴趣的游戏存下来</p>
              <a routerLink="/games">去发现</a>
            </div>
          } @else {
            <p class="library-count">共 {{ items().length }} 个游戏</p>
            <div class="game-grid">
              @for (item of items(); track item.uuid) {
                <div class="watch-later-item">
                  <a class="watch-later-card" [routerLink]="['/games', item.uuid]">
                    @if (item.coverPath) {
                      <div class="watch-later-cover"><img [src]="item.coverPath" [alt]="item.title" loading="lazy" /></div>
                    } @else {
                      <div class="watch-later-placeholder">{{ item.title?.[0] || '?' }}</div>
                    }
                    <div class="watch-later-info">
                      <strong>{{ item.title }}</strong>
                      @if (item.authorName) { <span>{{ item.authorName }}</span> }
                      <time>标记于 {{ formatDate(item.addedAt) }}</time>
                    </div>
                  </a>
                  <button class="watch-later-remove" type="button" (click)="remove(item.uuid)">
                    <my-global-icon iconName="delete" />
                    移除
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </main>
  `,
  styles: [`
    .watch-later-list { max-width: 900px; margin: 0 auto; padding: 1rem; }

    .watch-later-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      border-radius: var(--game-radius);
      background: var(--game-surface);
      border: 1px solid var(--game-border);
      transition: all 0.2s;
    }

    .watch-later-item:hover { border-color: var(--game-brand); }

    .watch-later-card {
      display: flex;
      gap: 0.75rem;
      text-decoration: none;
      color: inherit;
      align-items: center;
    }

    .watch-later-cover {
      width: 5rem;
      height: 5rem;
      border-radius: 6px;
      overflow: hidden;
      flex-shrink: 0;
    }

    .watch-later-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .watch-later-placeholder {
      width: 5rem;
      height: 5rem;
      border-radius: 6px;
      background: linear-gradient(135deg, var(--game-brand), #34d399);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    .watch-later-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .watch-later-info strong {
      font-size: 0.95rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .watch-later-info span {
      font-size: 0.8rem;
      color: var(--game-muted);
    }

    .watch-later-info time {
      font-size: 0.75rem;
      color: var(--game-muted);
    }

    .watch-later-remove {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      align-self: flex-start;
      background: none;
      border: 1px solid var(--game-border);
      border-radius: 6px;
      padding: 0.35rem 0.75rem;
      color: var(--game-muted);
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .watch-later-remove:hover {
      border-color: #ef4444;
      color: #ef4444;
    }

    .watch-later-remove my-global-icon {
      width: 0.85rem;
      height: 0.85rem;
    }
  `]
})
export class GameWatchLaterComponent implements OnInit {
  private readonly watchLaterService = inject(WatchLaterService)

  readonly items = signal<WatchLaterItem[]>([])

  ngOnInit () {
    this.loadItems()
  }

  loadItems () {
    this.items.set(this.watchLaterService.getItems())
  }

  remove (uuid: string) {
    this.watchLaterService.remove(uuid)
    this.items.update(items => items.filter(item => item.uuid !== uuid))
  }

  formatDate (dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }
}
