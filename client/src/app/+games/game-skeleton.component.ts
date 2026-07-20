import { ChangeDetectionStrategy, Component } from '@angular/core'

@Component({
  selector: 'my-game-skeleton',
  template: `
    <div class="game-skeleton-card" aria-label="加载中">
      <div class="game-skeleton-cover shimmer"></div>
      <div class="game-skeleton-stats">
        <div class="skeleton-stat shimmer"></div>
        <div class="skeleton-stat shimmer"></div>
        <div class="skeleton-stat shimmer"></div>
      </div>
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

    .game-skeleton-stats {
      display: flex;
      gap: 0.4rem;
      margin-top: 0.4rem;
    }

    .skeleton-stat {
      height: 0.75rem;
      width: 2.2rem;
      background: #eceff3;
      border-radius: 0.2rem;
    }

    .game-skeleton-body {
      padding: 0.45rem 0 0.6rem;
    }

    .game-skeleton-title {
      height: 1rem;
      background: #eceff3;
      border-radius: 0.25rem;
      width: 75%;
    }

    .game-skeleton-author {
      height: 0.8rem;
      background: #eceff3;
      border-radius: 0.25rem;
      margin-top: 0.35rem;
      width: 45%;
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .shimmer { animation: none; }
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