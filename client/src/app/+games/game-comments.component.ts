import { DatePipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, HostListener, inject, Input, signal } from '@angular/core'
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
  styles: [ `
    .feedback { color: var(--game-success);
      margin: 0.7rem 0 0; }

    .empty-comments { align-items: center;
      color: var(--game-muted);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 2.5rem 1rem;
      text-align: center; }
    .empty-comments my-global-icon { color: #d0d4da;
      height: 2.5rem;
      width: 2.5rem; }
    .empty-comments p { margin: 0;
      font-size: 0.9rem; }
    .empty-comments button { background: var(--game-brand);
      border: 0;
      border-radius: 999px;
      color: #fff;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.5rem 1.25rem;
      transition: opacity 160ms ease; }
    .empty-comments button:hover { opacity: 0.9; }

    /* Bilibili-like comment panel */
    .bili-comment-header {
      align-items: baseline;
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem 1.25rem;
      margin-bottom: 1rem;
    }
    .bili-comment-header h2 {
      color: #18191c;
      font-size: 1.15rem;
      font-weight: 600;
      margin: 0;
    }
    .bili-comment-count {
      color: #9499a0;
      font-size: 0.95rem;
      font-weight: 500;
      margin-left: 0.35rem;
    }
    .bili-comment-sort {
      align-items: center;
      display: inline-flex;
      gap: 0.45rem;
    }
    .bili-comment-sort button {
      background: transparent;
      border: 0;
      color: #9499a0;
      cursor: pointer;
      font-size: 0.88rem;
      padding: 0;
    }
    .bili-comment-sort button.active {
      color: #18191c;
      font-weight: 600;
    }
    .bili-sort-sep {
      color: #e3e5e7;
    }
    .bili-comment-composer {
      align-items: flex-start;
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1.1rem;
    }
    .bili-composer-avatar,
    .bili-comment-avatar,
    .bili-reply-avatar {
      background: #e5f7ff;
      border-radius: 50%;
      flex: 0 0 auto;
      object-fit: cover;
    }
    .bili-composer-avatar {
      height: 2.75rem;
      width: 2.75rem;
    }
    .bili-comment-avatar {
      height: 2.5rem;
      width: 2.5rem;
    }
    .bili-reply-avatar {
      height: 1.5rem;
      width: 1.5rem;
    }
    .bili-composer-body {
      display: grid;
      flex: 1;
      gap: 0.55rem;
      min-width: 0;
    }
    .bili-composer-body input {
      background: #f1f2f3;
      border: 0;
      border-radius: 8px;
      color: #18191c;
      font-size: 0.9rem;
      min-height: 2.75rem;
      padding: 0.65rem 0.9rem;
      width: 100%;
    }
    .bili-composer-body input:focus {
      background: #e3e5e7;
      outline: 0;
    }
    .bili-composer-actions {
      align-items: center;
      display: flex;
      gap: 0.65rem;
      justify-content: flex-end;
    }
    .bili-composer-tools {
      align-items: center;
      display: inline-flex;
      gap: 0.3rem;
      margin-right: auto;
    }
    .bili-composer-tool-wrap {
      display: inline-flex;
      position: relative;
    }
    .bili-composer-tool {
      align-items: center;
      background: transparent;
      border: 0;
      border-radius: 4px;
      box-sizing: border-box;
      color: #61666d;
      cursor: pointer;
      display: inline-flex;
      font-size: 0;
      height: 1.75rem;
      justify-content: center;
      line-height: 0;
      padding: 0;
      vertical-align: middle;
      width: 1.75rem;
    }
    .bili-composer-tool:hover,
    .bili-composer-tool:focus-visible {
      background: #f1f2f3;
      color: #00aeec;
      outline: 0;
    }
    .bili-composer-tool my-global-icon {
      display: inline-flex;
      height: 0.95rem;
      width: 0.95rem;
    }
    .bili-composer-tool input {
      display: none;
    }
    .bili-emoji-picker {
      background: #fff;
      border: 1px solid #e3e5e7;
      border-radius: 8px;
      bottom: calc(100% + 0.45rem);
      box-shadow: 0 8px 24px rgb(25 30 40 / 12%);
      display: grid;
      gap: 0.2rem;
      grid-template-columns: repeat(6, 1fr);
      left: 0;
      padding: 0.4rem;
      position: absolute;
      width: 13.5rem;
      z-index: 10;
    }
    .bili-emoji-option {
      align-items: center;
      background: transparent;
      border: 0;
      border-radius: 5px;
      cursor: pointer;
      display: flex;
      font-size: 1.05rem;
      height: 1.85rem;
      justify-content: center;
      line-height: 1;
      padding: 0;
      width: 1.85rem;
    }
    .bili-emoji-option:hover,
    .bili-emoji-option:focus-visible {
      background: #f1f2f3;
      outline: 0;
    }
    .bili-composer-image {
      align-items: center;
      background: #f6f7f8;
      border: 1px solid #e3e5e7;
      border-radius: 6px;
      display: flex;
      gap: 0.5rem;
      padding: 0.35rem 0.5rem;
    }
    .bili-composer-image img {
      border-radius: 4px;
      height: 3rem;
      object-fit: cover;
      width: 3rem;
    }
    .bili-composer-image span {
      color: #61666d;
      flex: 1;
      font-size: 0.78rem;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bili-composer-image button {
      align-items: center;
      background: transparent;
      border: 0;
      color: #9499a0;
      cursor: pointer;
      display: inline-flex;
      font-size: 0;
      height: 1.75rem;
      justify-content: center;
      line-height: 1;
      padding: 0.25rem;
      width: 1.75rem;
    }
    .bili-composer-image button my-global-icon {
      height: 1rem;
      width: 1rem;
    }
    .bili-comment-image {
      border-radius: 6px;
      display: block;
      margin: 0 0 0.5rem;
      max-height: 220px;
      max-width: min(360px, 100%);
      object-fit: contain;
    }
    .bili-cancel-reply {
      background: transparent;
      border: 0;
      color: #00aeec;
      font-size: 0.82rem;
    }
    .bili-send-btn {
      background: #00aeec;
      border: 0;
      border-radius: 6px;
      color: #fff;
      font-size: 0.85rem;
      font-weight: 600;
      min-width: 4.5rem;
      padding: 0.4rem 0.9rem;
    }
    .bili-send-btn:disabled {
      background: #e3e5e7;
      color: #9499a0;
      cursor: not-allowed;
    }
    .bili-comment-list {
      display: flex;
      flex-direction: column;
    }
    .bili-comment-item {
      border-top: 1px solid #f1f2f3;
      display: flex;
      gap: 0.75rem;
      padding: 1rem 0;
    }
    .bili-comment-item:first-child {
      border-top: 0;
      padding-top: 0.25rem;
    }
    .bili-comment-main,
    .bili-reply-main {
      flex: 1;
      min-width: 0;
    }
    .bili-comment-user {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-bottom: 0.25rem;
    }
    .bili-comment-user strong {
      color: #61666d;
      font-size: 0.86rem;
      font-weight: 600;
    }
    .bili-badge {
      border-radius: 2px;
      color: #fff;
      font-size: 0.62rem;
      font-weight: 700;
      line-height: 1;
      padding: 0.14rem 0.28rem;
    }
    .bili-badge.up {
      background: #fb7299;
    }
    .bili-comment-text {
      color: #18191c;
      font-size: 0.92rem;
      line-height: 1.65;
      margin: 0 0 0.4rem;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
    .bili-comment-meta {
      align-items: center;
      color: #9499a0;
      display: flex;
      flex-wrap: wrap;
      font-size: 0.78rem;
      gap: 0.85rem;
    }
    .bili-comment-meta time {
      color: #9499a0;
    }
    .bili-meta-btn {
      align-items: center;
      background: transparent;
      border: 0;
      color: #9499a0;
      cursor: pointer;
      display: inline-flex;
      gap: 0.2rem;
      height: 20px;
      justify-content: center;
      line-height: 20px;
      padding: 0;
      vertical-align: middle;
    }
    .bili-meta-btn my-global-icon {
      align-items: center;
      display: inline-flex;
      height: 0.85rem;
      justify-content: center;
      line-height: 0;
      width: 0.85rem;
    }
    .bili-meta-btn my-global-icon ::ng-deep svg { display: block; }
    .bili-meta-btn.active,
    .bili-meta-btn:hover {
      color: #00aeec;
    }
    .bili-meta-btn.danger:hover {
      color: #f25d8e;
    }
    .bili-view-replies {
      background: transparent;
      border: 0;
      color: #00aeec;
      cursor: pointer;
      font-size: 0.82rem;
      margin-top: 0.45rem;
      padding: 0;
    }
    .bili-reply-list {
      background: #f6f7f8;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 0.65rem;
      padding: 0.75rem 0.85rem;
    }
    .bili-reply-item {
      display: flex;
      gap: 0.5rem;
    }
    .bili-comment-skeleton {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .bili-skeleton-avatar {
      background: #eceff3;
      border-radius: 50%;
      flex: 0 0 2.5rem;
      height: 2.5rem;
    }
    .bili-skeleton-body {
      display: grid;
      flex: 1;
      gap: 0.45rem;
    }
    .bili-skeleton-line {
      background: #eceff3;
      border-radius: 4px;
      height: 0.85rem;
    }
    .bili-skeleton-line.short {
      width: 45%;
    }

    .comment-dialog { align-items: center;
      background: var(--game-brand-soft);
      border: 1px solid var(--game-border);
      border-radius: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      margin-top: 0.8rem;
      padding: 0.8rem; }
    .comment-dialog p { flex-basis: 100%;
      margin: 0; }
    .comment-dialog input { border: 1px solid var(--game-border);
      border-radius: 6px;
      flex: 1;
      min-width: 180px;
      padding: 0.55rem; }
    .comment-dialog button { border: 0;
      border-radius: 6px;
      padding: 0.5rem 0.75rem; }
    .comment-dialog .danger { background: var(--game-danger);
      color: #fff; }

    /* Comments load more */
    .comments-load-more {
      display: flex;
      justify-content: center;
      padding: 0.75rem 0;
    }

    .comments-load-more button {
      background: #fff;
      border: 1px solid var(--game-border);
      border-radius: 6px;
      color: var(--game-text);
      cursor: pointer;
      font-size: 0.82rem;
      font-weight: 600;
      padding: 0.45rem 1.25rem;
      transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
    }

    .comments-load-more button:hover:not(:disabled) {
      background: var(--game-brand-soft);
      border-color: var(--game-brand);
      color: var(--game-brand-deep);
    }

    .comments-load-more button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  ` ],
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

      <form class="bili-comment-composer" (submit)="submitComment($event)">
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
          @if (store.commentImage(); as image) {
            <div class="bili-composer-image">
              <img [src]="imageDataUrl()" [alt]="image.name">
              <span>{{ image.name }}</span>
              <button type="button" aria-label="移除图片" (click)="clearImage()"><my-global-icon iconName="cross" /></button>
            </div>
          }
          <div class="bili-composer-actions">
            <div class="bili-composer-tools">
              <div class="bili-composer-tool-wrap">
                <button
                  type="button"
                  class="bili-composer-tool"
                  aria-label="添加表情"
                  title="添加表情"
                  [attr.aria-expanded]="emojiOpen()"
                  (click)="toggleEmojiPicker($event)"
                >
                  <my-global-icon iconName="mood-smile" />
                </button>
                @if (emojiOpen()) {
                  <div class="bili-emoji-picker" role="dialog" aria-label="选择表情">
                    @for (emoji of emojiOptions; track emoji) {
                      <button
                        type="button"
                        class="bili-emoji-option"
                        [attr.aria-label]="'选择表情 ' + emoji"
                        (click)="selectEmoji(emoji, commentInput, $event)"
                      >
                        {{ emoji }}
                      </button>
                    }
                  </div>
                }
              </div>
              <label class="bili-composer-tool" aria-label="上传图片" title="上传图片">
                <my-global-icon iconName="upload" />
                <input type="file" accept="image/*" (change)="selectImage($event)">
              </label>
            </div>
            @if (store.replyTo()) {
              <button type="button" class="bili-cancel-reply" (click)="store.replyTo.set(null)">取消回复</button>
            }
            <button type="submit" class="bili-send-btn" [disabled]="!store.draft().trim()">发送</button>
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
                @if (comment.imageUrl) { <img class="bili-comment-image" [src]="comment.imageUrl" alt="评论图片" loading="lazy"> }
                <div class="bili-comment-meta">
                  <time>{{ comment.createdAt | date:'yyyy-MM-dd HH:mm' }}</time>
                  <button type="button" class="bili-meta-btn" [class.active]="comment.liked" (click)="store.toggleLike(comment)">
                    <my-global-icon iconName="like" />
                    <span>{{ comment.likes || 0 }}</span>
                  </button>
                  <button type="button" class="bili-meta-btn"
                    (click)="store.replyTo.set(comment.id); store.focusComposerInput()">回复</button>
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
                          @if (reply.imageUrl) { <img class="bili-comment-image" [src]="reply.imageUrl" alt="回复图片" loading="lazy"> }
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
  readonly imageDataUrl = signal('')
  readonly emojiOpen = signal(false)
  readonly emojiOptions = [ '😀', '😄', '😂', '🙂', '😉', '😍', '🤔', '😎', '🥳', '😭', '😡', '👍' ]

  /** Kept for API symmetry; the host wires the store directly. */
  @Input() gameTitle = ''

  @HostListener('document:click')
  closeEmojiPicker () {
    this.emojiOpen.set(false)
  }

  toggleEmojiPicker (event: Event) {
    event.stopPropagation()
    this.emojiOpen.update(open => !open)
  }

  selectEmoji (emoji: string, input: HTMLInputElement, event: Event) {
    event.stopPropagation()
    this.insertEmoji(input, emoji)
    this.emojiOpen.set(false)
  }

  private insertEmoji (input: HTMLInputElement, emoji: string) {
    const value = this.store.draft()
    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? start
    const prefix = start > 0 && !/\s$/.test(value.slice(0, start)) ? ' ' : ''
    const next = `${value.slice(0, start)}${prefix}${emoji}${value.slice(end)}`
    this.store.draft.set(next)
    queueMicrotask(() => {
      input.focus()
      const cursor = start + prefix.length + emoji.length
      input.setSelectionRange(cursor, cursor)
    })
  }

  selectImage (event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const allowedTypes = [ 'image/png', 'image/jpeg', 'image/webp', 'image/gif' ]
    if (!allowedTypes.includes(file.type)) {
      this.store.feedback.set('图片仅支持 PNG、JPG、WEBP 或 GIF')
      input.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      this.store.feedback.set('图片不能超过 5MB')
      input.value = ''
      return
    }
    this.store.setCommentImage(file)
    const reader = new FileReader()
    reader.onload = () => this.imageDataUrl.set(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  clearImage () {
    this.store.clearCommentImage()
    this.imageDataUrl.set('')
  }

  submitComment (event: Event) {
    event.preventDefault()
    const image = this.store.commentImage()
    if (this.store.replyTo()) this.store.submitReply(image)
    else this.store.submit(image)
  }
}
