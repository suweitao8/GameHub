import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { RouterLink } from '@angular/router'
import { AuthService } from '@app/core/auth/auth.service'
import { buildGameAvatarDataUrl } from './shared/game-avatar'
import { GAME_FEATURES } from './+games/shared'

@Component({
  template: `
    <main class="game-community-page game-account-page">
      <div class="game-community-content">
        <header class="game-account-header">
          <div>
            <p class="game-eyebrow">GameHub 账户</p>
            <h1>个人中心</h1>
            <p>管理你的 GameHub 主页、作品和社区互动。</p>
          </div>
          @if (user; as currentUser) {
            <img class="game-account-avatar" [src]="getAvatarUrl(currentUser)" [alt]="getDisplayName(currentUser) + '头像'">
          }
        </header>

        @if (user; as currentUser) {
          <section class="game-account-profile">
            <div>
              <strong>{{ getDisplayName(currentUser) }}</strong>
              <span>&#64;{{ currentUser.account?.name || currentUser.username }}</span>
            </div>
            <div class="game-account-profile-actions">
              @if (currentUser.account?.id) {
                <a [routerLink]="['/games/author', currentUser.account.id]">查看我的主页 →</a>
              } @else {
                <span
                  class="game-account-profile-unavailable shimmer"
                  style="display:inline-block;height:1.2rem;width:6rem;border-radius:4px;background:#eceff3"
                ></span>
              }
              <a routerLink="/my-account/settings">账户设置</a>
            </div>
          </section>

          <nav class="game-account-links" aria-label="个人中心导航">
            @if (creatorEnabled) {
              <a routerLink="/games/creator"><strong>创作中心</strong><span>上传、编辑和查看作品数据</span></a>
            }
            <a routerLink="/games/library" [queryParams]="{ tab: 'owned' }"><strong>我的作品</strong><span>管理已发布和审核中的游戏</span></a>
            <a routerLink="/games/library" [queryParams]="{ tab: 'favorites' }"><strong>收藏与历史</strong><span>继续游玩喜欢的作品</span></a>
            <a routerLink="/games/notifications"><strong>消息中心</strong><span>查看评论、关注和审核通知</span></a>
          </nav>
          <p class="game-account-note">账户、主页、创作和社区功能都已迁移到 GameHub，可以从上方入口继续使用。</p>
        } @else {
          <section class="game-account-empty">
            <h2>请先登录</h2>
            <p>登录后即可管理你的游戏和社区互动。</p>
            <a routerLink="/login">去登录</a>
          </section>
        }
      </div>
    </main>
  `,
  styleUrl: './game-account-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink ]
})
export class GameAccountHomeComponent {
  private readonly authService = inject(AuthService)
  readonly user = this.authService.isLoggedIn() ? this.authService.getUser() : undefined
  readonly creatorEnabled = GAME_FEATURES.creatorCenter

  getDisplayName (user: NonNullable<typeof this.user>) {
    return user.account?.displayName || user.username || 'GameHub 用户'
  }

  getAvatarUrl (user: NonNullable<typeof this.user>) {
    const avatar = user.account?.avatars?.[0]?.fileUrl
    return avatar || buildGameAvatarDataUrl(this.getDisplayName(user))
  }
}
