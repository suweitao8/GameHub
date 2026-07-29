import { ChangeDetectionStrategy, Component, HostListener, Input, OnDestroy, signal } from '@angular/core'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

/**
 * Screenshots gallery + lightbox.
 *
 * Self-manages the 5s carousel timer and clears it on destroy.
 * The host pauses the carousel when `paused` is true (e.g. on hover).
 * The lightbox takes over keyboard navigation (ESC/arrows) while open.
 */
@Component({
  selector: 'my-game-screenshots',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GlobalIconComponent ],
  styles: [`
    /* Screenshot gallery */
    .game-screenshots { width: 100%; }

    .screenshot-gallery {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .screenshot-main {
      border-radius: var(--game-radius);
      overflow: hidden;
      background: var(--game-surface);
      aspect-ratio: 16 / 9;
      max-height: 420px;
    }

    .screenshot-main img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #17191e;
    }

    .screenshot-thumbs {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      padding-bottom: 0.25rem;
    }

    .screenshot-thumbs button {
      width: 4.5rem;
      height: 4.5rem;
      border-radius: 6px;
      overflow: hidden;
      border: 2px solid transparent;
      cursor: pointer;
      padding: 0;
      background: var(--game-surface);
      transition: border-color 0.2s;
      flex-shrink: 0;
    }

    .screenshot-thumbs button.active { border-color: var(--game-brand); }
    .screenshot-thumbs button:hover:not(.active) { border-color: var(--game-border); }

    .screenshot-thumbs img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Screenshot Lightbox */
    .screenshot-lightbox {
      align-items: center;
      background: rgb(0 0 0 / 90%);
      display: flex;
      inset: 0;
      justify-content: center;
      position: fixed;
      z-index: 200;
    }

    .screenshot-lightbox img {
      max-height: 85vh;
      max-width: 90vw;
      object-fit: contain;
    }

    .lightbox-close {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      font-size: 2rem;
      line-height: 1;
      padding: 0;
      position: absolute;
      right: 1.5rem;
      top: 1.5rem;
      z-index: 2;
    }

    .lightbox-close:hover { color: var(--game-brand); }

    .lightbox-nav {
      align-items: center;
      background: rgb(255 255 255 / 10%);
      border: none;
      border-radius: 50%;
      color: #fff;
      cursor: pointer;
      display: flex;
      height: 3rem;
      justify-content: center;
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      transition: background-color 160ms ease;
      width: 3rem;
      z-index: 2;
    }

    .lightbox-nav:hover { background: rgb(255 255 255 / 20%); }

    .lightbox-nav my-global-icon {
      height: 1.5rem;
      width: 1.5rem;
    }

    .lightbox-prev { left: 1.5rem; }
    .lightbox-next { right: 1.5rem; }

    .lightbox-counter {
      background: rgb(0 0 0 / 50%);
      border-radius: 999px;
      bottom: 1.5rem;
      color: #fff;
      font-size: 0.85rem;
      padding: 0.35rem 0.85rem;
      position: absolute;
    }

    @media (max-width: 600px) {
      .lightbox-nav { height: 2.5rem; width: 2.5rem; }
      .lightbox-nav my-global-icon { height: 1.2rem; width: 1.2rem; }
      .lightbox-prev { left: 0.5rem; }
      .lightbox-next { right: 0.5rem; }
      .lightbox-close { right: 0.75rem; top: 0.75rem; font-size: 1.5rem; }
    }
  `],
  template: `
    @if (screenshots().length) {
      <section class="game-screenshots" aria-label="游戏截图"
               (mouseenter)="paused.set(true)"
               (mouseleave)="paused.set(false)">
        <div class="screenshot-gallery">
          <div class="screenshot-main">
            <img [src]="screenshots()[activeIndex()]" alt="游戏截图" loading="lazy" (click)="openLightbox()" style="cursor:zoom-in">
          </div>
          <div class="screenshot-thumbs">
            @for (url of screenshots(); track $index) {
              <button type="button" [class.active]="activeIndex() === $index" (click)="activeIndex.set($index)" [attr.aria-label]="'截图 ' + ($index + 1)">
                <img [src]="url" alt="" loading="lazy">
              </button>
            }
          </div>
        </div>
      </section>
    }

    @if (lightboxOpen()) {
      <div class="screenshot-lightbox" (click)="closeLightbox()" role="dialog" aria-label="截图查看">
        <button type="button" class="lightbox-close" (click)="closeLightbox()">&times;</button>
        @if (screenshots().length > 1) {
          <button type="button" class="lightbox-nav lightbox-prev" (click)="lightboxPrev(); $event.stopPropagation()"><my-global-icon iconName="chevron-left" /></button>
        }
        <img [src]="screenshots()[activeIndex()]" alt="游戏截图" (click)="$event.stopPropagation()">
        @if (screenshots().length > 1) {
          <button type="button" class="lightbox-nav lightbox-next" (click)="lightboxNext(); $event.stopPropagation()"><my-global-icon class="icon-flip-horizontal" iconName="chevron-left" /></button>
        }
        <span class="lightbox-counter">{{ activeIndex() + 1 }} / {{ screenshots().length }}</span>
      </div>
    }
  `
})
export class GameScreenshotsComponent implements OnDestroy {
  /** Screenshot URL list. Pass an empty array to render nothing. */
  readonly screenshots = signal<string[]>([])
  /** External pause hint. Internal hover also flips `paused`. */
  readonly paused = signal(false)

  readonly activeIndex = signal(0)
  readonly lightboxOpen = signal(false)

  private timer: ReturnType<typeof setInterval> | undefined

  @Input({ required: true }) set screenshotsInput (value: string[] | undefined | null) {
    this.screenshots.set(value ? [ ...value ] : [])
    this.activeIndex.set(0)
    this.startCarousel()
  }

  @Input() set pausedInput (value: boolean) {
    this.paused.set(value)
  }

  ngOnDestroy () {
    this.stopCarousel()
  }

  openLightbox () {
    this.lightboxOpen.set(true)
    this.stopCarousel()
  }

  closeLightbox () {
    this.lightboxOpen.set(false)
    this.startCarousel()
  }

  lightboxPrev () {
    const total = this.screenshots().length
    if (!total) return
    this.activeIndex.set((this.activeIndex() - 1 + total) % total)
  }

  lightboxNext () {
    const total = this.screenshots().length
    if (!total) return
    this.activeIndex.set((this.activeIndex() + 1) % total)
  }

  @HostListener('document:keydown', [ '$event' ])
  onKeydown (event: KeyboardEvent) {
    if (!this.lightboxOpen()) return
    if (event.key === 'Escape') { event.preventDefault(); this.closeLightbox(); return }
    if (event.key === 'ArrowLeft') { event.preventDefault(); this.lightboxPrev(); return }
    if (event.key === 'ArrowRight') { event.preventDefault(); this.lightboxNext(); return }
  }

  private startCarousel () {
    this.stopCarousel()
    const total = this.screenshots().length
    if (total <= 1) return
    this.timer = setInterval(() => {
      if (this.paused() || this.lightboxOpen()) return
      const count = this.screenshots().length
      if (count <= 1) return
      this.activeIndex.update(current => (current + 1) % count)
    }, 5000)
  }

  private stopCarousel () {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }
}
