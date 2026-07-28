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
