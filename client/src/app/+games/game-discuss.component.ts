import { DatePipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { GameDiscussStore } from './game-discuss-store'

/**
 * Discuss sidebar (chronological chat timeline).
 *
 * WeChat-style group chat. Its data source is deliberately separate from
 * the review/comment panel.
 */
@Component({
  selector: 'my-game-discuss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ DatePipe ],
  styleUrl: './game-discuss.component.scss',
  template: `
    <section class="game-discuss-panel" aria-labelledby="discuss-title">
      <header class="discuss-header">
        <h2 id="discuss-title">讨论群</h2>
      </header>
      <div class="wechat-message-list">
        @if (store.loading()) {
          @for (i of [1,2,3]; track $index) {
            <div class="discuss-skeleton shimmer"></div>
          }
        } @else {
          @for (msg of store.timeline(); track msg.id; let index = $index) {
            @if (store.shouldShowTime(index)) {
              <time class="wechat-time-separator">{{ msg.createdAt | date:'MM-dd HH:mm' }}</time>
            }
            <article class="wechat-message" [class.own]="store.isOwn(msg)">
              <img class="wechat-avatar" [src]="store.messageAvatar(msg)" alt="">
              <div class="wechat-message-body">
                <strong class="wechat-message-name">{{ msg.account?.displayName || msg.account?.name || '玩家' }}</strong>
                <p class="wechat-bubble">{{ msg.text }}</p>
              </div>
            </article>
          } @empty {
          <p class="discuss-empty">还没有人发言，来打个招呼吧</p>
          }
        }
      </div>
      @if (store.error()) { <p class="discuss-error" role="alert">{{ store.error() }}</p> }
      @if (store.feedback()) { <p class="discuss-error" role="status">{{ store.feedback() }}</p> }
      <form class="discuss-composer" (submit)="$event.preventDefault(); store.submit()">
        <input
          aria-label="讨论群消息"
          [value]="store.draft()"
          (input)="store.draft.set($any($event.target).value)"
          placeholder="在讨论群说点什么..."
          maxlength="2000"
        >
        <button type="submit" [disabled]="!store.draft().trim() || store.submitting()">{{ store.submitting() ? '发送中...' : '发送' }}</button>
      </form>
    </section>
  `
})
export class GameDiscussComponent {
  readonly store = inject(GameDiscussStore)
}
