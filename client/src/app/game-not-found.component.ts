import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterLink } from '@angular/router'

@Component({
  template: `
    <main class="game-community-page game-not-found-page">
      <section class="game-community-content game-not-found-card" aria-labelledby="game-not-found-title">
        <p class="game-eyebrow">GAMEHUB</p>
        <h1 id="game-not-found-title">这个页面不存在</h1>
        <p>链接可能已经失效，或者该内容还没有加入 GameHub。</p>
        <div class="game-not-found-actions">
          <a routerLink="/games" class="game-not-found-primary">回到发现页</a>
          <a routerLink="/games/upload" class="game-not-found-secondary">投稿游戏</a>
        </div>
      </section>
    </main>
  `,
  styleUrl: './game-not-found.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink ]
})
export class GameNotFoundComponent {}
