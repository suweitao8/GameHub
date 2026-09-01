import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core'
import type { GameLevelInfo } from './games.service'

@Component({
  selector: 'my-game-level-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    @if (levelInfo()) {
      <div class="level-badge" [class.level-up]="isLevelUp()">
        <span class="level-icon" [style.background-color]="levelColor()">{{ levelInfo().levelInfo.level }}</span>
        <div class="level-text">
          <span class="level-title">{{ levelInfo().levelInfo.title }}</span>
          <span class="level-exp">{{ levelInfo().exp }} EXP</span>
          @if (levelInfo().dailyLoginAvailable) {
            <span class="daily-available">可签到</span>
          }
        </div>
        @if (levelInfo().levelInfo.nextLevelExp) {
          <div class="level-progress">
            <div class="progress-bar" [style.width.%]="levelInfo().levelInfo.progress * 100"></div>
            <span class="progress-text">
              {{ levelInfo().exp - levelInfo().levelInfo.currentLevelExp }} /
              {{ levelInfo().levelInfo.nextLevelExp - levelInfo().levelInfo.currentLevelExp }}
            </span>
          </div>
        }
      </div>
    }
  `,
  styleUrl: './game-level-badge.component.scss'
})
export class GameLevelBadgeComponent {
  levelInfo = input<GameLevelInfo | null>(null)

  isLevelUp = computed(() => {
    // Would be set by parent component when level changes
    return false
  })

  levelColor = computed(() => {
    return this.levelInfo() ? 'var(--game-brand)' : 'var(--game-text-hint)'
  })
}
