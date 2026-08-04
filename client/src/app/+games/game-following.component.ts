import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink } from '@angular/router'
import { map } from 'rxjs/operators'
import { GamesService } from './games.service'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { createAsyncState } from './shared'
import { buildGameAvatarDataUrl } from '../shared/game-avatar'

export type FollowedAuthor = {
  id: number
  name: string
  displayName: string
  description: string
  handle: string
  followers: number
  games: number
}

@Component({
  selector: 'my-game-following',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ CommonModule, RouterLink, GlobalIconComponent ],
  template: `
    <div class="following-container">
      <div class="following-header">
        <h2>我的关注</h2>
        <p>关注的创作者及其最新动态</p>
      </div>

      @if (loading()) {
        <div class="following-skeleton">
          @for (i of [ 1, 2, 3, 4, 5 ]; track $index) { <div class="following-item shimmer"></div> }
        </div>
      } @else if (error()) {
        <div class="following-error">
          <span>加载失败，请重试</span>
          <button type="button" (click)="loadFollowing()">重新加载</button>
        </div>
      } @else if (following().length === 0) {
        <div class="following-empty">
          <span>还没有关注任何创作者</span>
          <p>关注喜欢的作者，第一时间获取他们的新作</p>
          <a routerLink="/games">去发现</a>
        </div>
      } @else {
        <div class="following-list">
          @for (author of following(); track author.id) {
            <a class="following-item" [routerLink]="['/games/author', author.id]">
              <div class="following-avatar">
                <img [src]="getAvatarUrl(author)" [alt]="author.displayName + '头像'">
              </div>
              <div class="following-info">
                <div class="following-name"><strong>{{ author.displayName }}</strong></div>
                <p class="following-desc">{{ author.description || '正在制作有趣的网页小游戏。' }}</p>
                <div class="following-stats">
                  <span><my-global-icon iconName="gamepad" />{{ author.games }} 个作品</span>
                  <span><my-global-icon iconName="users" />{{ author.followers }} 粉丝</span>
                </div>
              </div>
              <div class="following-arrow">
                <my-global-icon iconName="chevron-right" />
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: [ `
    .following-container { max-width: 900px; margin: 0 auto; padding: 1rem; }

    .following-header { margin-bottom: 1.5rem; }
    .following-header h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .following-header p { color: var(--game-muted); font-size: 0.9rem; margin: 0; }

    .following-list { display: flex; flex-direction: column; gap: 0.75rem; }

    .following-item {
      align-items: center;
      background: #fff;
      border: 1px solid var(--game-border);
      border-radius: var(--game-radius);
      color: inherit;
      display: flex;
      gap: 0.75rem;
      padding: 1rem;
      text-decoration: none;
      transition: border-color 160ms ease, box-shadow 160ms ease;
    }

    .following-item:hover {
      border-color: var(--game-brand);
      box-shadow: var(--game-shadow);
    }

    .following-avatar {
      flex: 0 0 auto;
      height: 3.2rem;
      width: 3.2rem;
      border-radius: 50%;
      overflow: hidden;
      background: var(--game-brand-soft);
    }

    .following-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .following-info { flex: 1; min-width: 0; }

    .following-name { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
    .following-name strong { font-size: 1rem; }

    .following-desc {
      color: var(--game-muted);
      font-size: 0.8rem;
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .following-stats {
      display: flex;
      gap: 1rem;
      margin-top: 0.5rem;
      font-size: 0.78rem;
      color: var(--game-muted);
    }

    .following-stats span { display: inline-flex; align-items: center; gap: 0.25rem; }
    .following-stats my-global-icon { height: 0.8rem; width: 0.8rem; }

    .following-arrow { flex: 0 0 auto; color: var(--game-muted); }
    .following-arrow my-global-icon { height: 1rem; width: 1rem; }

    .following-empty { text-align: center; padding: 3rem; color: var(--game-muted); }
    .following-empty span { display: block; font-size: 1.1rem; margin-bottom: 0.5rem; }
    .following-empty p { font-size: 0.82rem; margin: 0 0 1rem; }
    .following-empty a { color: var(--game-brand); text-decoration: none; font-weight: 700; }
    .following-empty a:hover { text-decoration: underline; }

    .following-error { text-align: center; padding: 3rem; color: var(--game-danger); }
    .following-error button {
      background: #fff;
      border: 1px solid var(--game-danger);
      border-radius: 6px;
      color: var(--game-danger);
      cursor: pointer;
      margin-top: 1rem;
      padding: 0.5rem 1rem;
    }

    .following-skeleton { display: flex; flex-direction: column; gap: 0.75rem; }
    .following-skeleton .following-item { height: 5rem; border-radius: var(--game-radius); }
  ` ]
})
export class GameFollowingComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  private readonly state = createAsyncState<FollowedAuthor[]>([])
  /** 模板兼容 */
  readonly following = computed(() => this.state.data() ?? [])
  readonly loading = this.state.loading
  readonly error = this.state.hasError

  ngOnInit () {
    this.loadFollowing()
  }

  loadFollowing () {
    this.state.load(this.gamesService.listFollowing().pipe(map(result => result.data)))
  }

  getAvatarUrl (author: FollowedAuthor) {
    return buildGameAvatarDataUrl(author.displayName || author.name || '创')
  }
}
