import { DatePipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core'
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
  styleUrl: './game-comments.component.scss',
  template: `
    <section class="game-comments bili-comment-panel" aria-labelledby="comments-title">
      <div class="bili-comment-header">
        <h2 id="comments-title">
          评论 <span class="bili-comment-count">{{ store.commentCount() || store.total() || store.comments().length || 0 }}</span>
        </h2>
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
              <div class="bili-composer-tool-wrap">
                <label
                  class="bili-composer-tool"
                  role="button"
                  tabindex="0"
                  aria-label="上传图片"
                  title="上传图片"
                  (keydown)="activateImagePicker($event, commentImageInput)"
                >
                  <my-global-icon iconName="upload" />
                  <input #commentImageInput type="file" accept="image/*" (change)="selectImage($event)">
                </label>
              </div>
            </div>
            @if (store.replyTo()) {
              <button type="button" class="bili-cancel-reply" (click)="store.replyTo.set(null)">取消回复</button>
            }
            <button type="submit" class="bili-send-btn"
              [disabled]="!store.draft().trim() || store.submitting()"
            >{{ store.submitting() ? '发送中...' : '发送' }}</button>
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

  activateImagePicker (event: KeyboardEvent, input: HTMLInputElement) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    event.stopPropagation()
    input.click()
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
