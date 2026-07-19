import { ChangeDetectionStrategy, Component } from '@angular/core'

@Component({
  selector: 'my-game-skeleton',
  template: `
    <div class="game-skeleton-card" aria-label="加载中">
      <div class="game-skeleton-cover shimmer"></div>
      <div class="game-skeleton-body">
        <div class="game-skeleton-title shimmer"></div>
        <div class="game-skeleton-author shimmer"></div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .game-skeleton-card {
      display: block;
      overflow: hidden;
    }

    .game-skeleton-cover {
      aspect-ratio: 16 / 9;
      background: #eceff3;
      border-radius: 0.5rem;
    }

    .game-skeleton-body {
      padding: 0.55rem 0 0.8rem;
    }

    .game-skeleton-title {
      height: 1.05rem;
      background: #eceff3;
      border-radius: 0.25rem;
      width: 80%;
    }

    .game-skeleton-author {
      height: 0.85rem;
      background: #eceff3;
      border-radius: 0.25rem;
      margin-top: 0.42rem;
      width: 50%;
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .shimmer {
      background: linear-gradient(90deg, #eceff3 25%, #f5f7fa 50%, #eceff3 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite linear;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameSkeletonComponent {}