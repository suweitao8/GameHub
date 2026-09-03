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
import { averageColorFromPixels, buildGameCoverDataUrl, getReadableTextColor } from '../../shared/game-cover'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { GameCardComponent } from '../game-card.component'

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
  /** Uploaded cover URLs that failed to load -> use the deterministic title cover. */
  readonly brokenFeaturedCovers = signal<Record<string, true>>({})
  /** Average image colors used by the below-image featured information bar. */
  readonly featuredColors = signal<Record<string, string>>({})
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
    if (game.coverPath && !this.brokenFeaturedCovers()[game.uuid]) return game.coverPath
    return buildGameCoverDataUrl(game.title, game.category)
  }

  featuredColor (game: Game) {
    return this.featuredColors()[game.uuid] || 'var(--game-cover-fallback-deep)'
  }

  featuredTextColor (game: Game) {
    const color = this.featuredColors()[game.uuid]
    return color ? getReadableTextColor(color) : 'var(--game-text-primary)'
  }

  formatCount (value: number | undefined) {
    if (!value) return '0'
    if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
    return `${value}`
  }

  formatDate (value: string | null | undefined) {
    if (!value) return '--'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '--'
    return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(date).replaceAll('/', '-')
  }

  onFeaturedCoverError (uuid: string) {
    if (this.brokenFeaturedCovers()[uuid]) return
    this.brokenFeaturedCovers.update(map => ({ ...map, [uuid]: true }))
  }

  onFeaturedCoverLoad (event: Event, uuid: string) {
    const image = event.target as HTMLImageElement | null
    if (!image?.naturalWidth || !image.naturalHeight) return

    const canvas = document.createElement('canvas')
    canvas.width = 24
    canvas.height = 14
    const context = canvas.getContext('2d', { willReadFrequently: true })

    if (!context) return

    try {
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const color = averageColorFromPixels(context.getImageData(0, 0, canvas.width, canvas.height).data)
      this.featuredColors.update(map => map[uuid] === color ? map : ({ ...map, [uuid]: color }))
    } catch {
      // Cross-origin covers can be displayed but not sampled by canvas. Keep the
      // token-based fallback so a failed color extraction never breaks the card.
    }
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
