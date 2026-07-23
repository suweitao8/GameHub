import { ChangeDetectionStrategy, Component, ElementRef, Input, OnDestroy, OnInit, signal, inject } from '@angular/core'
import { RouterLink } from '@angular/router'
import { buildGameAvatarDataUrl } from '../shared/game-avatar'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { Game } from './games.service'
import { HighlightPipe } from './highlight.pipe'

@Component({
  selector: 'my-game-card',
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GlobalIconComponent, RouterLink, HighlightPipe ]
})
export class GameCardComponent implements OnInit, OnDestroy {
  @Input({ required: true }) game!: Game
  @Input() searchTerm: string | undefined
  readonly coverUnavailable = signal(false)
  readonly isVisible = signal(false)

  private readonly elementRef = inject(ElementRef<HTMLElement>)
  private observer: IntersectionObserver | undefined

  private readonly categoryLabels: Record<string, string> = {
    arcade: '动作', adventure: '冒险', shooter: '射击', puzzle: '解谜', casual: '休闲', rpg: '角色扮演', strategy: '策略',
    simulation: '模拟', sandbox: '沙盒', sports: '体育', card: '卡牌', music: '音乐', horror: '恐怖', board: '桌游'
  }

  ngOnInit () {
    this.observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.isVisible.set(true)
            this.observer?.unobserve(this.elementRef.nativeElement)
          }
        }
      },
      { rootMargin: '100px 0px', threshold: 0 }
    )

    this.observer.observe(this.elementRef.nativeElement)
  }

  ngOnDestroy () {
    this.observer?.disconnect()
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

  getAuthorAvatar (label: string | undefined) {
    return buildGameAvatarDataUrl(label || '创')
  }

  categoryLabel () {
    return this.categoryLabels[this.game.category] || '小游戏'
  }

  onCoverError () {
    this.coverUnavailable.set(true)
  }
}
