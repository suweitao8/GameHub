import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { WatchLaterService, WatchLaterItem } from './watch-later.service'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { buildGameCoverDataUrl } from '../shared/game-cover'

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
                    <div class="watch-later-cover">
                      <img [src]="coverUrl(item)" [alt]="item.title + ' 封面'" loading="lazy" (error)="onCoverError(item)" />
                    </div>
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
  styleUrl: './game-watch-later.component.scss'
})
export class GameWatchLaterComponent implements OnInit {
  private readonly watchLaterService = inject(WatchLaterService)

  readonly items = signal<WatchLaterItem[]>([])
  readonly coverFallbacks = signal<Record<string, true>>({})

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

  coverUrl (item: WatchLaterItem) {
    if (item.coverPath && !this.coverFallbacks()[item.uuid]) return item.coverPath
    return buildGameCoverDataUrl(item.title)
  }

  onCoverError (item: WatchLaterItem) {
    if (!item.coverPath || this.coverFallbacks()[item.uuid]) return
    this.coverFallbacks.update(state => ({ ...state, [item.uuid]: true }))
  }

  formatDate (dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }
}
