import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output, signal } from '@angular/core'
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
  styles: [`
    /* Share Dialog */
    .share-dialog-overlay {
      align-items: center;
      background: rgb(0 0 0 / 50%);
      display: flex;
      inset: 0;
      justify-content: center;
      position: fixed;
      z-index: 100;
    }

    .share-dialog {
      background: #fff;
      border-radius: var(--game-radius);
      max-width: 420px;
      overflow: hidden;
      width: calc(100% - 2rem);
    }

    .share-dialog-header {
      align-items: center;
      border-bottom: 1px solid var(--game-border);
      display: flex;
      justify-content: space-between;
      padding: 0.85rem 1rem;
    }

    .share-dialog-header h3 { font-size: 1rem; margin: 0; }

    .share-close-btn {
      background: none;
      border: none;
      color: var(--game-muted);
      cursor: pointer;
      font-size: 1.4rem;
      line-height: 1;
      padding: 0;
      width: 1.5rem;
    }

    .share-close-btn:hover { color: var(--game-text); }

    .share-dialog-body { padding: 1rem; }

    .share-game-title {
      font-size: 0.95rem;
      font-weight: 600;
      margin: 0 0 1rem;
      text-align: center;
    }

    .share-url-box {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .share-url-box input {
      background: var(--game-surface);
      border: 1px solid var(--game-border);
      border-radius: 6px;
      color: var(--game-text);
      flex: 1;
      font-size: 0.82rem;
      min-width: 0;
      padding: 0.5rem 0.75rem;
    }

    .share-url-box button {
      background: var(--game-brand);
      border: 1px solid var(--game-brand);
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
      font-size: 0.82rem;
      font-weight: 600;
      padding: 0.5rem 0.85rem;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .share-url-box button.copied { background: #22c55e; border-color: #22c55e; }

    .share-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
    }

    .share-btn {
      align-items: center;
      border-radius: 50%;
      color: #fff;
      display: inline-flex;
      font-size: 0.82rem;
      font-weight: 700;
      height: 2.8rem;
      justify-content: center;
      text-decoration: none;
      transition: transform 0.2s;
      width: 2.8rem;
    }

    .share-btn:hover { transform: scale(1.1); }

    .share-btn.weibo { background: #e6162d; }
    .share-btn.qq { background: #12b7f5; }
    .share-btn.twitter { background: #000; }

    @media (max-width: 600px) {
      .share-dialog { max-width: calc(100% - 1rem); }
      .share-actions { flex-wrap: wrap; }
    }
  `],
  template: `
    @if (isOpen()) {
      <div class="share-dialog-overlay" (click)="requestClose()">
        <div class="share-dialog" (click)="$event.stopPropagation()">
          <div class="share-dialog-header">
            <h3>分享游戏</h3>
            <button type="button" class="share-close-btn" (click)="requestClose()">&times;</button>
          </div>
          <div class="share-dialog-body">
            <p class="share-game-title">{{ gameSignal()?.title }}</p>
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

  readonly gameSignal = signal<Game | null>(null)
  @Input() set game (value: Game | null) { this.gameSignal.set(value) }

  /** Two-way controlled visibility: `<my-game-share-dialog [(open)]="shareOpen" />`. */
  @Input() set open (value: boolean) {
    this.isOpen.set(value)
    if (!value) this.copied.set(false)
  }
  readonly isOpen = signal(false)

  @Output() openChange = new EventEmitter<boolean>()
  @Output() close = new EventEmitter<void>()
  @Output() error = new EventEmitter<void>()

  readonly url = signal('')
  readonly copied = signal(false)

  private readonly encoder = encodeURIComponent

  encodedUrl () { return this.encoder(this.url()) }
  encodedTitle () { return this.encoder(this.gameSignal()?.title || '') }

  requestClose () {
    this.openChange.emit(false)
    this.close.emit()
  }

  /** Trigger the share flow. Returns true if the dialog was shown. */
  async share (): Promise<boolean> {
    const current = this.gameSignal()
    if (!current) return false
    try {
      const result = await this.gamesService.share(current.uuid).toPromise()
      const resolved = result?.shortUrl || window.location.href
      if (navigator.share) {
        await navigator.share({ title: current.title, url: resolved })
        return false
      }
      this.url.set(resolved)
      this.isOpen.set(true)
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
