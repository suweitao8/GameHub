import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink } from '@angular/router'
import { map } from 'rxjs/operators'
import { GamesService } from './games.service'
import { createAsyncState } from './shared'

export type GameTagCloud = {
  tag: string
  gameCount: number
}

@Component({
  selector: 'my-game-tags-cloud',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="tags-cloud-container">
      <div class="tags-cloud-header">
        <h2>热门标签</h2>
        <p>按游戏标签发现感兴趣的内容</p>
      </div>

      @if (loading()) {
        <div class="tags-cloud-skeleton">
          @for (i of [1,2,3,4,5,6,7,8,9,10]; track $index) {
            <div class="tag-skeleton shimmer"></div>
          }
        </div>
      } @else if (filteredTags().length) {
        <div class="tags-cloud">
          @for (item of filteredTags(); track item.tag) {
            <a class="tag-pill"
               [routerLink]="['/games']"
               [queryParams]="{ search: item.tag }"
               [style.font-size.px]="getTagSize(item)"
               [style.opacity]="getTagOpacity(item)">
              {{ item.tag }}
              <span class="tag-count">{{ item.gameCount }}</span>
            </a>
          }
        </div>
      } @else {
        <p class="tags-cloud-empty">暂无标签数据</p>
      }
    </div>
  `,
  styleUrl: './game-tags-cloud.component.scss'
})
export class GameTagsCloudComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  readonly tagsState = createAsyncState<GameTagCloud[]>()
  /** 模板兼容：直接返回 data */
  readonly tags = computed(() => this.tagsState.data() ?? [])
  readonly filteredTags = computed(() => this.tags().slice(0, 20))
  /** 模板兼容：底层 state 的 loading 别名 */
  readonly loading = this.tagsState.loading

  ngOnInit () {
    const sorted$ = this.gamesService.listTags().pipe(
      map(result => result.filter(item => item.gameCount >= 1).sort((a, b) => b.gameCount - a.gameCount))
    )
    this.tagsState.load(sorted$)
  }

  getTagSize (item: GameTagCloud): number {
    const max = this.tags()[0]?.gameCount || 1
    const ratio = item.gameCount / max
    return 12 + ratio * 8 // Range: 12px ~ 20px
  }

  getTagOpacity (item: GameTagCloud): number {
    const max = this.tags()[0]?.gameCount || 1
    const ratio = item.gameCount / max
    return 0.55 + ratio * 0.45 // Range: 0.55 ~ 1.0
  }
}
