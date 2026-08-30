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
import { FEATURED_PLACEHOLDER_AVG_RGB } from '../games-home.constants'
import { coverInitial, coverToneClass } from '../cover-tone'

/**
 * Big featured carousel + side card grid on the games home page.
 *
 * Self-manages: carousel index, touch swipe, auto-rotation, and per-cover
 * average color canvas sampling with a visible placeholder fallback. Driven entirely
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
  /** Five bottom-cover segment RGB strings for the footer and matching fade. */
  readonly featuredAvgColors = signal<Record<string, string[]>>({})
  /** Cover URLs that failed to load -> show the same brown placeholder as no-cover games. */
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

  /** 与卡片一致的确定性封面色调（占位渐变 + footer 同色系） */
  coverToneClass (game: Game) {
    return coverToneClass(game.uuid || game.title)
  }

  /** 占位大图中央的水印字（标题首字符） */
  coverInitial (game: Game) {
    return coverInitial(game.title)
  }

  onFeaturedCoverError (uuid: string) {
    if (this.brokenFeaturedCovers()[uuid]) return
    this.brokenFeaturedCovers.update(map => ({ ...map, [uuid]: true }))
  }

  /** Footer uses a single solid color — the average of the five sampled segments. */
  featuredAvgColor (game: Game) {
    const rgb = this.averageRgb(this.featuredColors(game)).replace(/,\s*/g, ' ')
    return `rgb(${rgb})`
  }

  /** Fade the bottom of the cover into the footer color: opaque at the bottom,
   *  fully transparent at the top — a clean linear disappear effect. */
  featuredCoverFade (game: Game) {
    const rgb = this.averageRgb(this.featuredColors(game)).replace(/,\s*/g, ' ')
    return `linear-gradient(180deg, rgb(${rgb} / 0%) 0%, rgb(${rgb}) 100%)`
  }

  private featuredColors (game: Game) {
    return this.featuredAvgColors()[game.uuid] || Array.from({ length: 5 }, () => FEATURED_PLACEHOLDER_AVG_RGB)
  }

  private averageRgb (colors: string[]) {
    const totals = colors.reduce((result, color) => {
      const [ red, green, blue ] = color.split(',').map(value => Number(value.trim()))
      result[0] += red
      result[1] += green
      result[2] += blue
      return result
    }, [ 0, 0, 0 ])

    return totals.map(value => Math.round(value / colors.length)).join(', ')
  }

  onFeaturedImageLoad (event: Event, uuid: string) {
    if (this.featuredAvgColors()[uuid]) return

    const image = event.target as HTMLImageElement
    if (!image.naturalWidth || !image.naturalHeight) return

    try {
      const canvas = document.createElement('canvas')
      // Read only the bottom tenth of a small downsampled cover. The footer is
      // split into five horizontal segments so its color follows the visible
      // lower edge instead of an unrelated seeded color.
      canvas.width = 32
      canvas.height = 32
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return

      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      const sampleHeight = Math.max(1, Math.round(canvas.height * 0.1))
      const segmentCount = 5
      const segmentWidth = canvas.width / segmentCount
      const colors: string[] = []

      for (let segment = 0; segment < segmentCount; segment++) {
        const startX = Math.floor(segment * segmentWidth)
        const endX = Math.max(startX + 1, Math.floor((segment + 1) * segmentWidth))
        let red = 0
        let green = 0
        let blue = 0
        let count = 0

        for (let y = canvas.height - sampleHeight; y < canvas.height; y++) {
          for (let x = startX; x < endX; x++) {
            const index = (y * canvas.width + x) * 4
            if (pixels[index + 3] < 128) continue
            red += pixels[index]
            green += pixels[index + 1]
            blue += pixels[index + 2]
            count++
          }
        }

        if (!count) return
        colors.push(`${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)}`)
      }

      this.featuredAvgColors.update(map => ({ ...map, [uuid]: colors }))
    } catch {
      // Cross-origin cover images may not be readable by canvas; keep the brown placeholder fallback.
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
