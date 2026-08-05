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
  styleUrl: './game-screenshots.component.scss',
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
