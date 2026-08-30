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
  styleUrl: './game-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameSkeletonComponent {}
