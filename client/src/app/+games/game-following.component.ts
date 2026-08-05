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
  styleUrl: './game-following.component.scss'
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
