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
  styles: [ `
    :host {
      box-sizing: border-box;
      display: block;
      flex: 1 1 auto;
      height: 100%;
      min-height: 0;
    }

    /* WeChat-style discussion group */
    .game-discuss-panel {
      background: #fff;
      border: 1px solid #e3e5e7;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: none;
      min-height: 0;
      overflow: hidden;
      padding: 0;
    }
    .discuss-header {
      align-items: center;
      background: #fff;
      border-bottom: 1px solid #e3e5e7;
      display: flex;
      height: 36px;
      justify-content: flex-start;
      min-height: 36px;
      padding: 0 12px;
    }
    .discuss-header h2 {
      color: #1e1e1e;
      font-size: 0.9rem;
      line-height: 20px;
      margin: 0;
    }
    .discuss-member-count {
      display: none;
    }
    .wechat-message-list {
      background: #fff;
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
      overflow-y: auto;
      padding: 12px;
    }
    .wechat-message {
      align-items: flex-start;
      display: flex;
      gap: 8px;
      max-width: 92%;
    }
    .wechat-message.own {
      align-self: flex-end;
      flex-direction: row-reverse;
    }
    .wechat-avatar {
      border-radius: 50%;
      flex: 0 0 auto;
      height: 2rem;
      object-fit: cover;
      width: 2rem;
    }
    .wechat-message-body {
      min-width: 0;
    }
    .wechat-message-name {
      color: #646970;
      display: block;
      font-size: 0.7rem;
      margin: 0 0 0.2rem;
    }
    .wechat-message.own .wechat-message-name { text-align: right; }
    .wechat-bubble {
      background: #f1f2f3;
      border: 1px solid #e3e5e7;
      border-radius: 0.25rem 0.65rem 0.65rem;
      color: #303133;
      font-size: 0.82rem;
      line-height: 1.45;
      overflow-wrap: anywhere;
      padding: 7px 10px;
      white-space: pre-wrap;
    }
    .wechat-message.own .wechat-bubble {
      background: #95ec69;
      border-color: #95ec69;
      border-radius: 0.65rem 0.25rem 0.65rem 0.65rem;
      color: #303133;
    }
    .wechat-time-separator {
      align-self: center;
      color: #9499a0;
      display: block;
      font-size: 0.66rem;
      line-height: 20px;
      margin: 2px auto;
      text-align: center;
    }
    .discuss-empty {
      color: var(--game-muted);
      font-size: 0.8rem;
      margin: auto 0;
      text-align: center;
    }
    .discuss-skeleton {
      background: #e8eaed;
      border-radius: 8px;
      height: 3rem;
    }
    .discuss-composer {
      align-items: center;
      background: #fff;
      border-top: 1px solid #e3e5e7;
      display: flex;
      gap: 8px;
      min-height: 52px;
      padding: 10px 12px;
    }
    .discuss-composer input {
      background: #f1f2f3;
      border: 1px solid transparent;
      border-radius: 6px;
      flex: 1;
      font-size: 0.82rem;
      line-height: 20px;
      min-width: 0;
      padding: 6px 8px;
    }
    .discuss-composer input:focus {
      border-color: #00aeec;
      outline: 0;
    }
    .discuss-composer button {
      background: var(--game-brand);
      border: 0;
      border-radius: 6px;
      color: #fff;
      flex: 0 0 auto;
      font-size: 0.8rem;
      font-weight: 600;
      line-height: 20px;
      min-height: 32px;
      padding: 6px 10px;
    }
    .discuss-composer button:disabled {
      background: #e3e5e7;
      color: #9499a0;
      cursor: not-allowed;
    }

    @media (max-width: 900px) {
      :host { flex: 0 0 auto; }
      .game-discuss-panel { height: auto; min-height: 260px; }
      .discuss-composer { align-items: stretch; flex-direction: column; }
    }
  ` ],
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
          maxlength="5000"
        >
        <button type="submit" [disabled]="!store.draft().trim()">发送</button>
      </form>
    </section>
  `
})
export class GameDiscussComponent {
  readonly store = inject(GameDiscussStore)
}
