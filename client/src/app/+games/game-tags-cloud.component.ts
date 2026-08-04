import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink } from '@angular/router'
import { HttpClient } from '@angular/common/http'
import { map } from 'rxjs/operators'
import { environment } from '../../environments/environment'
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
  styles: [`
    .tags-cloud-container {
      max-width: 900px;
      margin: 2rem auto;
      padding: 1rem;
    }

    .tags-cloud-header {
      text-align: center;
      margin-bottom: 1.25rem;
    }

    .tags-cloud-header h2 {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
    }

    .tags-cloud-header p {
      color: var(--game-muted);
      font-size: 0.82rem;
      margin: 0;
    }

    .tags-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      justify-content: center;
      padding: 0.5rem;
    }

    .tag-pill {
      align-items: center;
      background: #fff;
      border: 1px solid var(--game-border);
      border-radius: 999px;
      color: var(--game-text);
      cursor: pointer;
      display: inline-flex;
      gap: 0.3rem;
      padding: 0.4rem 0.75rem;
      text-decoration: none;
      transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease, transform 120ms ease;
    }

    .tag-pill:hover {
      background: var(--game-brand-soft);
      border-color: var(--game-brand);
      color: var(--game-brand-deep);
      transform: scale(1.05);
    }

    .tag-count {
      background: var(--game-border);
      border-radius: 999px;
      color: var(--game-muted);
      font-size: 0.62rem;
      font-weight: 600;
      padding: 0.1rem 0.35rem;
    }

    .tags-cloud-empty {
      color: var(--game-muted);
      font-size: 0.85rem;
      text-align: center;
      padding: 1.5rem;
    }

    .tags-cloud-skeleton {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      justify-content: center;
    }

    .tag-skeleton {
      width: 4rem;
      height: 1.8rem;
      border-radius: 999px;
      background: #eceff3;
    }
  `]
})
export class GameTagsCloudComponent implements OnInit {
  private readonly http = inject(HttpClient)
  readonly tagsState = createAsyncState<GameTagCloud[]>()
  /** 模板兼容：直接返回 data */
  readonly tags = computed(() => this.tagsState.data() ?? [])
  readonly filteredTags = computed(() => this.tags().slice(0, 20))
  /** 模板兼容：底层 state 的 loading 别名 */
  readonly loading = this.tagsState.loading

  ngOnInit () {
    const sorted$ = this.http.get<GameTagCloud[]>(`${environment.apiUrl}/api/v1/games/tags`).pipe(
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
