import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { buildGameAvatarDataUrl } from '../shared/game-avatar'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { Game } from './games.service'

@Component({
  selector: 'my-game-card',
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GlobalIconComponent, RouterLink ]
})
export class GameCardComponent {
  @Input({ required: true }) game!: Game
  readonly coverUnavailable = signal(false)

  private readonly categoryLabels: Record<string, string> = {
    arcade: '动作', adventure: '冒险', shooter: '射击', puzzle: '解谜', casual: '休闲', rpg: '角色扮演', strategy: '策略',
    simulation: '模拟', sandbox: '沙盒', racing: '竞速', sports: '体育', card: '卡牌', music: '音乐', horror: '恐怖', board: '桌游'
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
