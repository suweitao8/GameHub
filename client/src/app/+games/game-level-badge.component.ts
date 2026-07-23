import { Component, input, computed } from '@angular/core'
import type { GameLevelInfo } from './games.service'

@Component({
  selector: 'my-game-level-badge',
  standalone: true,
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
              {{ levelInfo().exp - levelInfo().levelInfo.currentLevelExp }} / {{ levelInfo().levelInfo.nextLevelExp - levelInfo().levelInfo.currentLevelExp }}
            </span>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .level-badge {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.5rem 0.8rem;
      border-radius: var(--game-radius);
      background: var(--game-surface);
      border: 1px solid var(--game-border);
      transition: transform 0.2s ease;
    }

    .level-badge.level-up {
      animation: levelUpPulse 1s ease-in-out;
    }

    @keyframes levelUpPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); box-shadow: 0 0 12px rgb(255 193 7 / 50%); }
    }

    .level-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      color: #fff;
      font-size: 0.8rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    .level-text {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;
    }

    .level-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--game-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .level-exp {
      font-size: 0.7rem;
      color: var(--game-muted);
    }

    .daily-available {
      font-size: 0.65rem;
      color: var(--game-success);
      background: rgb(34 197 94 / 10%);
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      width: fit-content;
    }

    .level-progress {
      position: relative;
      width: 4rem;
      height: 0.35rem;
      background: var(--game-border);
      border-radius: 999px;
      overflow: hidden;
      flex-shrink: 0;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--game-brand) 0%, #34d399 100%);
      border-radius: 999px;
      transition: width 0.5s ease;
    }

    .progress-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 0.55rem;
      color: var(--game-muted);
      white-space: nowrap;
    }
  `]
})
export class GameLevelBadgeComponent {
  levelInfo = input<GameLevelInfo | null>(null)

  isLevelUp = computed(() => {
    // Would be set by parent component when level changes
    return false
  })

  levelColor = computed(() => {
    const level = this.levelInfo()?.levelInfo.level ?? 0
    const colors = [
      '#9ca3af', // LV0 gray
      '#22c55e', // LV1 green
      '#3b82f6', // LV2 blue
      '#8b5cf6', // LV3 purple
      '#f59e0b', // LV4 amber
      '#ef4444', // LV5 red
      '#dc2626'  // LV6 crimson
    ]
    return colors[Math.min(level, 6)]
  })
}
