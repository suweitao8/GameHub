import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterLink } from '@angular/router'

@Component({
  template: `
    <main class="game-community-page game-about-page">
      <div class="game-community-content">
        <section class="game-about-hero">
          <div>
            <p class="game-eyebrow">GAMEHUB COMMUNITY</p>
            <h1>发现、制作并分享你的下一款小游戏</h1>
            <p>GameHub 是一个专注于 HTML 小游戏的社区。打开即玩，安全运行，也欢迎每一位创作者投稿。</p>
            <div class="game-about-actions">
              <a class="game-about-primary" routerLink="/games">开始发现</a>
              <a class="game-about-secondary" routerLink="/games/upload">投稿游戏</a>
            </div>
          </div>
          <div class="game-about-orbit" aria-hidden="true"><span>PLAY</span><span>CREATE</span><span>SHARE</span></div>
        </section>

        <section class="game-about-stats" aria-label="GameHub 特点">
          <article><strong>单文件运行</strong><span>HTML 或 ZIP 游戏包都能上传，打开页面即可试玩。</span></article>
          <article><strong>安全检测</strong><span>发布前校验资源路径和脚本能力，减少不必要的风险。</span></article>
          <article><strong>社区互动</strong><span>点赞、收藏、投币、评论和关注作者，和创作者一起成长。</span></article>
        </section>

        <section class="game-about-columns">
          <article class="game-about-card">
            <p class="game-eyebrow">FOR PLAYERS</p>
            <h2>玩家可以做什么</h2>
            <ul>
              <li>按类型、热度和发布时间寻找适合自己的游戏。</li>
              <li>记录游玩历史，收藏喜欢的作品，并在评论区交流。</li>
              <li>关注作者，在动态中心查看新的作品和互动消息。</li>
            </ul>
            <a routerLink="/games/library" [queryParams]="{ tab: 'recent' }">查看我的游玩记录 →</a>
          </article>
          <article class="game-about-card">
            <p class="game-eyebrow">FOR CREATORS</p>
            <h2>创作者可以做什么</h2>
            <ul>
              <li>上传单个 HTML 文件或包含根目录 index.html 的 ZIP 包。</li>
              <li>补充封面、简介、操作说明、类型和标签，让作品更容易被发现。</li>
              <li>在创作中心管理作品、查看互动数据并下载原始游戏包。</li>
            </ul>
            <a routerLink="/games/creator">进入创作中心 →</a>
          </article>
        </section>

        <section class="game-about-rules">
          <div><p class="game-eyebrow">COMMUNITY RULES</p><h2>社区规范</h2><p>请保持友善、尊重原创，不上传恶意代码、侵权内容或诱导外部跳转的页面。</p></div>
          <div class="game-about-rule-list"><span>尊重作者署名和许可</span><span>不发布恶意或欺诈内容</span><span>举报问题并共同维护社区</span></div>
        </section>
      </div>
    </main>
  `,
  styleUrl: './game-about.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink ]
})
export class GameAboutComponent {}
