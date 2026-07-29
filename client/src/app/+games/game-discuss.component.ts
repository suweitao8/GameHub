import { DatePipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { GameCommentsStore } from './game-comments-store'

/**
 * Discuss sidebar (chronological chat timeline).
 *
 * Shares the `GameCommentsStore` with the comment panel so posting in either
 * place updates both views.
 */
@Component({
  selector: 'my-game-discuss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ DatePipe ],
  styles: [`
    /* Discussion group sidebar */
    .game-discuss-panel {
      background: #fff;
      border: 1px solid var(--game-border);
      border-radius: var(--game-radius);
      display: flex;
      flex-direction: column;
      max-height: 380px;
      min-height: 260px;
      padding: 0.75rem;
    }
    .game-discuss-panel > h2 {
      font-size: 0.95rem;
      margin: 0 0 0.55rem;
    }
    .discuss-message-list {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 0.55rem;
      min-height: 0;
      overflow-y: auto;
      padding-right: 0.15rem;
    }
    .discuss-message {
      background: #f6f7f8;
      border-radius: 8px;
      padding: 0.45rem 0.55rem;
    }
    .discuss-message strong {
      color: #61666d;
      display: block;
      font-size: 0.75rem;
      margin-bottom: 0.15rem;
    }
    .discuss-message p {
      color: #18191c;
      font-size: 0.82rem;
      line-height: 1.45;
      margin: 0;
      overflow-wrap: anywhere;
    }
    .discuss-message time {
      color: #9499a0;
      display: block;
      font-size: 0.7rem;
      margin-top: 0.2rem;
    }
    .discuss-empty {
      color: var(--game-muted);
      font-size: 0.8rem;
      margin: auto 0;
      text-align: center;
    }
    .discuss-skeleton {
      background: #eceff3;
      border-radius: 8px;
      height: 3rem;
    }
    .discuss-composer {
      display: flex;
      gap: 0.4rem;
      margin-top: 0.55rem;
    }
    .discuss-composer input {
      background: #f1f2f3;
      border: 0;
      border-radius: 6px;
      flex: 1;
      font-size: 0.82rem;
      min-width: 0;
      padding: 0.45rem 0.55rem;
    }
    .discuss-composer button {
      background: var(--game-brand);
      border: 0;
      border-radius: 6px;
      color: #fff;
      flex: 0 0 auto;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.45rem 0.7rem;
    }

    @media (max-width: 900px) {
      .discuss-composer { align-items: stretch; flex-direction: column; }
    }
  `],
  template: `
    <section class="game-discuss-panel" aria-labelledby="discuss-title">
      <h2 id="discuss-title">讨论群</h2>
      <div class="discuss-message-list" #discussList>
        @if (store.loading()) {
          @for (i of [1,2,3]; track $index) {
            <div class="discuss-skeleton shimmer"></div>
          }
        } @else {
          @for (msg of store.timeline(); track msg.id) {
            <article class="discuss-message">
              <strong>{{ msg.account?.displayName || msg.account?.name || '玩家' }}</strong>
              <p>{{ msg.text }}</p>
              <time>{{ msg.createdAt | date:'MM-dd HH:mm' }}</time>
            </article>
          } @empty {
            <p class="discuss-empty">还没有人发言，来打个招呼吧</p>
          }
        }
      </div>
      <form class="discuss-composer" (submit)="$event.preventDefault(); store.submitChat()">
        <input
          aria-label="讨论群消息"
          [value]="store.chatDraft()"
          (input)="store.chatDraft.set($any($event.target).value)"
          placeholder="在讨论群说点什么..."
          maxlength="5000"
        >
        <button type="submit">发送</button>
      </form>
    </section>
  `
})
export class GameDiscussComponent {
  readonly store = inject(GameCommentsStore)
}
