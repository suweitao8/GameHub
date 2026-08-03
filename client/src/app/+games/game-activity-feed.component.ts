import { Component, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterModule } from '@angular/router'
import type { GameActivity } from './games.service'
import { GamesService } from './games.service'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-game-activity-feed',
  standalone: true,
  imports: [ CommonModule, RouterModule, GlobalIconComponent ],
  template: `
    <div class="feed-container">
      <div class="feed-header">
        <h2>社区动态</h2>
        <div class="feed-tabs">
          <button [class.active]="tab() === 'following'" (click)="setTab('following')">关注动态</button>
          <button [class.active]="tab() === 'public'" (click)="setTab('public')">发现</button>
        </div>
      </div>

      @if (loading() && activities().length === 0) {
        <div class="feed-skeleton-list">
          @for (i of [1,2,3,4,5,6]; track $index) {
            <div class="feed-skeleton-item">
              <div class="skeleton-avatar shimmer"></div>
              <div class="skeleton-content">
                <div class="skeleton-line shimmer" style="width:70%"></div>
                <div class="skeleton-line shimmer" style="width:40%"></div>
              </div>
            </div>
          }
        </div>
      }

      <div class="feed-list">
        @if (refreshing()) {
          <div class="feed-refresh-bar" role="status"><my-global-icon iconName="refresh-cw" /><span>刷新中...</span></div>
        }
        @for (activity of activities(); track activity.id) {
          <div class="feed-item" [attr.data-kind]="activity.kind">
            <div class="feed-avatar">
              @if (activity.actor) {
                <span>{{ activity.actor.name.charAt(0).toUpperCase() }}</span>
              } @else {
                <span>?</span>
              }
            </div>
            <div class="feed-content">
              <p class="feed-message">{{ activity.message }}</p>
              @if (activity.game) {
                <a class="feed-game" [routerLink]="['/games', activity.game.uuid]">
                  {{ activity.game.title }}
                </a>
              }
              <span class="feed-time">{{ formatTime(activity.createdAt) }}</span>
            </div>
            <div class="feed-kind-badge" [class]="activity.kind">
              {{ kindLabel(activity.kind) }}
            </div>
          </div>
        } @empty {
          @if (!loading()) {
            <div class="feed-empty">
              @if (tabError()) {
                <span>加载失败</span>
                <p>请检查网络后重试</p>
                <button type="button" (click)="retry()">重新加载</button>
              } @else if (tab() === 'following') {
                <span>关注列表暂无动态</span>
                <p>去发现页浏览更多内容</p>
                <button type="button" (click)="setTab('public')">去看看</button>
              } @else {
                <span>暂无社区动态</span>
                <p>成为第一个分享游戏动态的玩家</p>
              }
            </div>
          }
        }
      </div>

      @if (hasMore() && activities().length > 0) {
        <button class="load-more" (click)="loadMore()" [disabled]="loadingMore()">
          @if (loadingMore()) {
            <my-global-icon iconName="loader" /><span>加载中...</span>
          } @else {
            <span>加载更多</span>
          }
        </button>
      }
    </div>
  `,
  styles: [ `
    .feed-container { max-width: 680px; margin: 0 auto; padding: 1rem; }
    .feed-header { margin-bottom: 1rem; }
    .feed-header h2 { font-size: 1.4rem; margin-bottom: 0.75rem; }

    .feed-tabs {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid var(--game-border);
    }

    .feed-tabs button {
      padding: 0.5rem 1rem;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      font-size: 0.9rem;
      color: var(--game-muted);
      transition: all 0.2s;
    }

    .feed-tabs button.active {
      color: var(--game-brand);
      border-bottom-color: var(--game-brand);
    }

    .feed-list { display: flex; flex-direction: column; gap: 0.5rem; }

    .feed-refresh-bar {
      align-items: center;
      background: var(--game-brand-soft);
      border-radius: var(--game-radius);
      color: var(--game-brand-deep);
      display: flex;
      font-size: 0.82rem;
      gap: 0.5rem;
      justify-content: center;
      padding: 0.5rem;
    }

    .feed-refresh-bar my-global-icon {
      animation: spin 0.8s linear infinite;
      height: 0.9rem;
      width: 0.9rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .feed-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border-radius: var(--game-radius);
      background: var(--game-surface);
      border: 1px solid var(--game-border);
      animation: feedItemIn 300ms ease-out;
    }

    @keyframes feedItemIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .feed-item:hover {
      border-color: var(--game-brand);
      transform: translateX(2px);
    }

    .feed-avatar {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--game-brand), #34d399);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 0.9rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    .feed-content { flex: 1; min-width: 0; }
    .feed-message { font-size: 0.9rem; color: var(--game-text); margin: 0 0 0.25rem; }
    .feed-game { font-size: 0.8rem; color: var(--game-brand); text-decoration: none; }
    .feed-game:hover { text-decoration: underline; }
    .feed-time { font-size: 0.7rem; color: var(--game-muted); display: block; margin-top: 0.25rem; }

    .feed-kind-badge {
      font-size: 0.65rem;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      background: var(--game-border);
      color: var(--game-muted);
      flex-shrink: 0;
    }

    .feed-kind-badge.publish { background: #dbeafe; color: #3b82f6; }
    .feed-kind-badge.like { background: #fee2e2; color: #ef4444; }
    .feed-kind-badge.coin { background: #fef3c7; color: #f59e0b; }
    .feed-kind-badge.favorite { background: #dbeafe; color: #3b82f6; }
    .feed-kind-badge.comment { background: #d1fae5; color: #22c55e; }

    .feed-empty {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--game-muted);
    }

    .feed-empty span { font-size: 1.1rem; display: block; margin-bottom: 0.5rem; }
    .feed-empty p { font-size: 0.8rem; margin: 0 0 1rem; }
    .feed-empty button {
      background: var(--game-brand);
      border: 1px solid var(--game-brand);
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
      font-size: 0.85rem;
      padding: 0.45rem 0.9rem;
    }

    .load-more {
      width: 100%;
      padding: 0.75rem;
      margin-top: 1rem;
      border: 1px solid var(--game-border);
      background: var(--game-surface);
      border-radius: var(--game-radius);
      cursor: pointer;
      color: var(--game-text);
      font-size: 0.9rem;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
    }

    .load-more my-global-icon { animation: spin 0.8s linear infinite; height: 0.85rem; width: 0.85rem; }
    .load-more:hover:not(:disabled) { background: var(--game-border); }
    .load-more:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Skeleton */
    .feed-skeleton-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .feed-skeleton-item {
      align-items: center;
      display: flex;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border-radius: var(--game-radius);
      background: var(--game-surface);
      border: 1px solid var(--game-border);
    }
    .skeleton-avatar {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      background: #eceff3;
      flex-shrink: 0;
    }
    .skeleton-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex: 1;
    }
    .skeleton-line {
      height: 0.75rem;
      border-radius: 4px;
      background: #eceff3;
    }
  ` ]
})
export class GameActivityFeedComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  activities = signal<GameActivity[]>([])
  tab = signal<'following' | 'public'>('following')
  loading = signal(false)
  loadingMore = signal(false)
  refreshing = signal(false)
  tabError = signal(false)
  hasMore = signal(true)
  offset = 0
  private requestGeneration = 0

  ngOnInit () {
    this.loadFeed()
  }

  setTab (tab: 'following' | 'public') {
    if (this.tab() === tab) return
    this.tab.set(tab)
    this.offset = 0
    this.activities.set([])
    this.tabError.set(false)
    this.hasMore.set(true)
    this.loadFeed()
  }

  loadFeed (options: { append?: boolean; offset?: number; rollbackOffset?: number } = {}) {
    const append = options.append === true
    const requestOffset = options.offset ?? this.offset
    const generation = ++this.requestGeneration

    this.loading.set(!append)
    this.loadingMore.set(append)
    this.tabError.set(false)
    const service = this.tab() === 'following'
      ? this.gamesService.getFeed(requestOffset, 20)
      : this.gamesService.getPublicFeed(requestOffset, 20)

    service.subscribe({
      next: (result) => {
        if (generation !== this.requestGeneration) return
        if (append) this.activities.update(prev => [ ...prev, ...result.data ])
        else this.activities.set(result.data)
        this.hasMore.set(result.data.length === 20)
        this.loading.set(false)
        this.loadingMore.set(false)
        this.refreshing.set(false)
      },
      error: () => {
        if (generation !== this.requestGeneration) return
        if (append && options.rollbackOffset !== undefined) this.offset = options.rollbackOffset
        if (this.activities().length === 0) this.tabError.set(true)
        this.loading.set(false)
        this.refreshing.set(false)
        this.loadingMore.set(false)
      }
    })
  }

  loadMore () {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return

    const rollbackOffset = this.offset
    const nextOffset = rollbackOffset + 20
    this.offset = nextOffset
    this.loadFeed({ append: true, offset: nextOffset, rollbackOffset })
  }

  retry () {
    this.offset = 0
    this.activities.set([])
    this.tabError.set(false)
    this.hasMore.set(true)
    this.loadFeed()
  }

  kindLabel (kind: string): string {
    const labels: Record<string, string> = {
      publish: '发布', like: '点赞', coin: '投币', favorite: '收藏',
      comment: '评论', reply: '回复', follow: '关注'
    }
    return labels[kind] || kind
  }

  formatTime (dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = (now.getTime() - date.getTime()) / 1000

    if (diff < 60) return '刚刚'
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    if (diff < 604800) return `${Math.floor(diff / 86400)}天前`
    return date.toLocaleDateString('zh-CN')
  }
}
