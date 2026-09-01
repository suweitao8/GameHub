import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  OnDestroy,
  output,
  signal
} from '@angular/core'
import { RouterLink } from '@angular/router'
import { Game } from '../games.service'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { GameCardComponent } from '../game-card.component'
import { coverInitial } from '../cover-tone'

/**
 * Big featured carousel + side card grid on the games home page.
 *
 * Self-manages: carousel index, touch swipe and auto-rotation. Driven entirely
 * by the `games` input (the recommended list from the parent); the first 6
 * entries drive the carousel.
 */
@Component({
  selector: 'my-featured-carousel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GameCardComponent, GlobalIconComponent, RouterLink ],
  templateUrl: './featured-carousel.component.html',
  styleUrl: './featured-carousel.component.scss'
})
export class FeaturedCarouselComponent implements OnDestroy {
  /** Recommended games; the parent passes the full recommended list. */
  readonly games = input<Game[]>([])
  /** Free-text search term forwarded to side game cards for highlighting. */
  readonly searchTerm = input<string>('')

  readonly carouselIndex = signal(0)
  /** Cover URLs that failed to load -> show the same neutral placeholder as no-cover games. */
  readonly brokenFeaturedCovers = signal<Record<string, true>>({})
  private carouselTimer: ReturnType<typeof setInterval> | undefined
  private touchStartX = 0
  private touchStartY = 0
  private readonly swipeThreshold = 50

  constructor () {
    this.startCarousel()
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    // Reset to the first slide whenever the recommended list is reloaded by
    // the parent (mirrors the parent's previous carouselIndex.set(0)).
    effect(() => {
      const list = this.games()
      // Touch identity so the effect re-runs on a new array reference.
      if (list) this.carouselIndex.set(0)
    })
  }

  ngOnDestroy () {
    if (this.carouselTimer) clearInterval(this.carouselTimer)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
  }

  /** Emitted when the "换一批" side action is clicked. */
  readonly shuffle = output()

  carouselGames () {
    return this.games().slice(0, 6)
  }

  carouselGame () {
    const list = this.carouselGames()
    return list.length ? list[this.carouselIndex() % list.length] : null
  }

  sideGames () {
    return this.games().slice(1, 7)
  }

  featuredCoverPath (game: Game) {
    if (!game.coverPath || this.brokenFeaturedCovers()[game.uuid]) return null
    return game.coverPath
  }

  /** 占位图使用标题首字符，帮助用户在没有封面时识别内容。 */
  coverInitial (game: Game) {
    return coverInitial(game.title)
  }

  onFeaturedCoverError (uuid: string) {
    if (this.brokenFeaturedCovers()[uuid]) return
    this.brokenFeaturedCovers.update(map => ({ ...map, [uuid]: true }))
  }

  nextCarousel (step = 1) {
    const total = this.carouselGames().length
    if (!total) return
    this.carouselIndex.set((this.carouselIndex() + step + total) % total)
  }

  onCarouselTouchStart (event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].screenX
    this.touchStartY = event.changedTouches[0].screenY
  }

  onCarouselTouchEnd (event: TouchEvent) {
    const endX = event.changedTouches[0].screenX
    const endY = event.changedTouches[0].screenY
    const deltaX = endX - this.touchStartX
    const deltaY = endY - this.touchStartY

    // Ignore if vertical scroll is dominant
    if (Math.abs(deltaY) > Math.abs(deltaX)) return

    if (Math.abs(deltaX) > this.swipeThreshold) {
      this.nextCarousel(deltaX < 0 ? 1 : -1)
    }
  }

  private startCarousel () {
    if (this.carouselTimer) clearInterval(this.carouselTimer)
    this.carouselTimer = setInterval(() => this.nextCarousel(), 6000)
  }

  private readonly onVisibilityChange = () => {
    if (this.carouselTimer) clearInterval(this.carouselTimer)
    if (!document.hidden) this.startCarousel()
  }
}
