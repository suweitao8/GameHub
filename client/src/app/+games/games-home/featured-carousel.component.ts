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
import { FEATURED_FALLBACK_COLORS } from '../games-home.constants'

/**
 * Big featured carousel + side card grid on the games home page.
 *
 * Self-manages: carousel index, touch swipe, auto-rotation, and per-cover
 * average color canvas sampling with a seeded fallback palette. Driven entirely
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
  /** Cover average RGB string "r, g, b" for the solid footer and matching fade. */
  readonly featuredAvgColors = signal<Record<string, string>>({})
  /** Cover URLs that failed to load → show colorful placeholder. */
  readonly brokenFeaturedCovers = signal<Record<string, true>>({})
  private carouselTimer: ReturnType<typeof setInterval> | undefined
  private touchStartX = 0
  private touchStartY = 0
  private readonly swipeThreshold = 50
  private readonly fallbackColors = FEATURED_FALLBACK_COLORS

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

  onFeaturedCoverError (uuid: string) {
    if (this.brokenFeaturedCovers()[uuid]) return
    this.brokenFeaturedCovers.update(map => ({ ...map, [uuid]: true }))
  }

  /** Solid average color of the full cover (fallback seeded palette). */
  featuredAvgColor (game: Game) {
    const stored = this.featuredAvgColors()[game.uuid]
    if (stored) return `rgb(${stored})`
    return `rgb(${this.fallbackAvgRgb(game.uuid)})`
  }

  /** Bottom 1/6 of cover: fade into the cover average color at full opacity. */
  featuredCoverFade (game: Game) {
    const rgb = this.featuredAvgColors()[game.uuid] || this.fallbackAvgRgb(game.uuid)
    return `linear-gradient(180deg, rgb(${rgb} / 0%) 0%, rgb(${rgb} / 100%) 100%)`
  }

  private fallbackAvgRgb (uuid: string) {
    const seed = Array.from(uuid || 'G').reduce((total, character) => total + character.charCodeAt(0), 0)
    return this.fallbackColors[seed % this.fallbackColors.length]
  }

  onFeaturedImageLoad (event: Event, uuid: string) {
    if (this.featuredAvgColors()[uuid]) return

    const image = event.target as HTMLImageElement
    if (!image.naturalWidth || !image.naturalHeight) return

    try {
      const canvas = document.createElement('canvas')
      // Downsample whole cover for average color
      canvas.width = 32
      canvas.height = 32
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return

      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      let red = 0
      let green = 0
      let blue = 0
      let count = 0

      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] < 128) continue
        red += pixels[index]
        green += pixels[index + 1]
        blue += pixels[index + 2]
        count++
      }

      if (!count) return
      const avg = `${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)}`
      this.featuredAvgColors.update(map => ({ ...map, [uuid]: avg }))
    } catch {
      // Cross-origin cover images may not be readable by canvas; use the fallback palette.
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
