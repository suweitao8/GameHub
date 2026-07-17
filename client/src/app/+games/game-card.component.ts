import { ChangeDetectionStrategy, Component, Input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { Game } from './games.service'

@Component({
  selector: 'my-game-card',
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink ]
})
export class GameCardComponent {
  @Input({ required: true }) game!: Game

  formatCount (value: number | undefined) {
    if (!value) return '0'
    if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
    return `${value}`
  }
}
