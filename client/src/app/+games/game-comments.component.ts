import { DatePipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { GameCommentsStore } from './game-comments-store'

/**
 * Main-column comment panel (Bilibili-style).
 *
 * Reads its state from the shared `GameCommentsStore` provided by the host
 * container so it stays in sync with the discuss sidebar.
 */
@Component({
  selector: 'my-game-comments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ DatePipe, GlobalIconComponent ],
  template: `
    <section class="game-comments bili-comment-panel" aria-labelledby="comments-title">
      <div class="bili-comment-header">
        <h2 id="comments-title">评论 <span class="bili-comment-count">{{ store.total() || store.comments().length || 0 }}</span></h2>
        <div class="bili-comment-sort" role="group" aria-label="评论排序">
          <button type="button" [class.active]="store.sort() === 'hot'" (click)="store.setSort('hot')">最热</button>
          <span class="bili-sort-sep" aria-hidden="true">|</span>
          <button type="button" [class.active]="store.sort() === 'new'" (click)="store.setSort('new')">最新</button>
        </div>
      </div>

      <form class="bili-comment-composer" (submit)="$event.preventDefault(); store.replyTo() ? store.submitReply() : store.submit()">
        <img class="bili-composer-avatar" [src]="store.currentUserAvatar()" alt="" aria-hidden="true">
        <div class="bili-composer-body">
          <input
            #commentInput
            aria-label="评论内容"
            [value]="store.draft()"
            (input)="store.draft.set($any($event.target).value)"
            [placeholder]="store.replyTo() ? '回复这条评论...' : '这里是评论区，不是无人区:-)'"
            maxlength="5000"
          >
          <div class="bili-composer-actions">
            @if (store.replyTo()) {
              <button type="button" class="bili-cancel-reply" (click)="store.replyTo.set(null)">取消回复</button>
            }
            <button type="submit" class="bili-send-btn">{{ store.replyTo() ? '回复' : '发布' }}</button>
          </div>
        </div>
      </form>
      @if (store.feedback()) { <p class="feedback" role="status">{{ store.feedback() }}</p> }

      <div class="bili-comment-list">
        @if (store.loading()) {
          @for (i of [1,2,3]; track $index) {
            <div class="bili-comment-skeleton shimmer">
              <div class="bili-skeleton-avatar"></div>
              <div class="bili-skeleton-body"><div class="bili-skeleton-line"></div><div class="bili-skeleton-line short"></div></div>
            </div>
          }
        } @else if (store.error()) {
          <p class="feedback" role="alert">{{ store.error() }}</p>
        } @else {
          @for (comment of store.sorted(); track comment.id) {
            <article class="bili-comment-item">
              <img class="bili-comment-avatar" [src]="store.commentAvatar(comment)" alt="" loading="lazy">
              <div class="bili-comment-main">
                <div class="bili-comment-user">
                  <strong>{{ comment.account?.displayName || comment.account?.name || '玩家' }}</strong>
                  @if (comment.isAuthor) { <span class="bili-badge up">UP</span> }
                </div>
                <p class="bili-comment-text">{{ comment.text }}</p>
                <div class="bili-comment-meta">
                  <time>{{ comment.createdAt | date:'yyyy-MM-dd HH:mm' }}</time>
                  <button type="button" class="bili-meta-btn" [class.active]="comment.liked" (click)="store.toggleLike(comment)">
                    <my-global-icon iconName="like" />
                    <span>{{ comment.likes || 0 }}</span>
                  </button>
                  <button type="button" class="bili-meta-btn" (click)="store.replyTo.set(comment.id); store.focusComposerInput()">回复</button>
                  @if (comment.canDelete) {
                    <button type="button" class="bili-meta-btn danger" (click)="store.requestDelete(comment)">删除</button>
                  }
                </div>

                @if (store.replies()[comment.id]; as replyList) {
                  <div class="bili-reply-list">
                    @for (reply of replyList; track reply.id) {
                      <article class="bili-reply-item">
                        <img class="bili-reply-avatar" [src]="store.commentAvatar(reply)" alt="" loading="lazy">
                        <div class="bili-reply-main">
                          <div class="bili-comment-user">
                            <strong>{{ reply.account?.displayName || reply.account?.name || '玩家' }}</strong>
                            @if (reply.isAuthor) { <span class="bili-badge up">UP</span> }
                          </div>
                          <p class="bili-comment-text">{{ reply.text }}</p>
                          <div class="bili-comment-meta">
                            <time>{{ reply.createdAt | date:'yyyy-MM-dd HH:mm' }}</time>
                            <button type="button" class="bili-meta-btn" [class.active]="reply.liked" (click)="store.toggleLike(reply)">
                              <my-global-icon iconName="like" />
                              <span>{{ reply.likes || 0 }}</span>
                            </button>
                            @if (reply.canDelete) {
                              <button type="button" class="bili-meta-btn danger" (click)="store.requestDelete(reply)">删除</button>
                            }
                          </div>
                        </div>
                      </article>
                    }
                  </div>
                } @else if (comment.totalReplies) {
                  <button type="button" class="bili-view-replies" (click)="store.toggleReplies(comment)">
                    共{{ comment.totalReplies }}条回复，点击查看
                  </button>
                }
              </div>
            </article>
          } @empty {
            <div class="empty-comments">
              <my-global-icon iconName="message-circle" />
              <p>还没有评论，来抢沙发吧</p>
              <button type="button" (click)="store.focusComposerInput()">写评论</button>
            </div>
          }
        }
      </div>

      @if (store.hasMore()) {
        <div class="comments-load-more">
          <button type="button" [disabled]="store.loadingMore()" (click)="store.loadMore()">
            {{ store.loadingMore() ? '加载中...' : '加载更多评论' }}
          </button>
        </div>
      }

      @if (store.deleteTarget(); as target) {
        <div class="comment-dialog" role="dialog" aria-label="确认删除评论">
          <p>确定删除这条评论吗？</p>
          <button type="button" (click)="store.deleteTarget.set(null)">取消</button>
          <button type="button" class="danger" (click)="store.confirmDelete()">确认删除</button>
        </div>
      }
    </section>
  `
})
export class GameCommentsComponent {
  readonly store = inject(GameCommentsStore)

  /** Kept for API symmetry; the host wires the store directly. */
  @Input() gameTitle = ''
}
