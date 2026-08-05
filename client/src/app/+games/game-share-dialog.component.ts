import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core'
import { Game, GamesService } from './games.service'

/**
 * Share-game dialog.
 *
 * Visibility is controlled via the `open` input (two-way style via `openChange`
 * / `close`). Call `share()` from the host's share button to trigger the flow:
 * tries the Web Share API first, falls back to the dialog when unavailable.
 */
@Component({
  selector: 'my-game-share-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './game-share-dialog.component.scss',
  template: `
    @if (open()) {
      <div class="share-dialog-overlay" (click)="requestClose()">
        <div class="share-dialog" (click)="$event.stopPropagation()">
          <div class="share-dialog-header">
            <h3>分享游戏</h3>
            <button type="button" class="share-close-btn" (click)="requestClose()">&times;</button>
          </div>
          <div class="share-dialog-body">
            <p class="share-game-title">{{ game()?.title }}</p>
            <div class="share-url-box">
              <input type="text" [value]="url()" readonly (click)="$event.target.select()">
              <button type="button" [class.copied]="copied()" (click)="copyUrl()">
                {{ copied() ? '已复制' : '复制链接' }}
              </button>
            </div>
            <div class="share-actions">
              <a [href]="'https://service.weibo.com/share/share.php?url=' + encodedUrl() + '&title=' + encodedTitle()" target="_blank" class="share-btn weibo">
                <span>微博</span>
              </a>
              <a [href]="'https://connect.qq.com/widget/shareqq/index.html?url=' + encodedUrl() + '&title=' + encodedTitle()" target="_blank" class="share-btn qq">
                <span>QQ</span>
              </a>
              <a [href]="'https://twitter.com/intent/tweet?url=' + encodedUrl() + '&text=' + encodedTitle()" target="_blank" class="share-btn twitter">
                <span>X</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class GameShareDialogComponent {
  private readonly gamesService = inject(GamesService)

  readonly game = input<Game | null>(null)

  /** Two-way controlled visibility: `<my-game-share-dialog [(open)]="shareOpen" />`. */
  readonly open = input(false)

  readonly openChange = output<boolean>()
  readonly close = output<void>()
  readonly error = output<void>()

  readonly url = signal('')
  readonly copied = signal(false)

  // 关闭时清除 copied 状态（替代原 setter 副作用）
  private readonly closeEffect = effect(() => {
    if (!this.open()) this.copied.set(false)
  })

  private readonly encoder = encodeURIComponent

  encodedUrl () { return this.encoder(this.url()) }
  encodedTitle () { return this.encoder(this.game()?.title || '') }

  requestClose () {
    this.openChange.emit(false)
    this.close.emit()
  }

  /** Trigger the share flow. Returns true if the dialog was shown. */
  async share (): Promise<boolean> {
    const current = this.game()
    if (!current) return false
    try {
      const result = await this.gamesService.share(current.uuid).toPromise()
      const resolved = result?.shortUrl || window.location.href
      if (navigator.share) {
        await navigator.share({ title: current.title, url: resolved })
        return false
      }
      this.url.set(resolved)
      // Trigger share via openChange (parent controls the open state)
      this.openChange.emit(true)
      this.openChange.emit(true)
      return true
    } catch {
      this.error.emit()
      return false
    }
  }

  copyUrl () {
    navigator.clipboard?.writeText(this.url()).then(() => {
      this.copied.set(true)
      setTimeout(() => this.copied.set(false), 2000)
    })
  }
}
