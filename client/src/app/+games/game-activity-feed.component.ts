import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterModule } from '@angular/router'
import type { GameActivity } from './games.service'
import { GamesService } from './games.service'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-game-activity-feed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ CommonModule, RouterModule, GlobalIconComponent ],
  template: `
    <div class="feed-container">
      <div class="feed-header">
        <h2>社区动态</h2>
        <div class="feed-tabs">
          <button type="button" [class.active]="tab() === 'following'" (click)="setTab('following')">关注动态</button>
          <button type="button" [class.active]="tab() === 'public'" (click)="setTab('public')">发现</button>
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
        <button type="button" class="load-more" (click)="loadMore()" [disabled]="loadingMore()">
          @if (loadingMore()) {
            <my-global-icon iconName="loader" /><span>加载中...</span>
          } @else {
            <span>加载更多</span>
          }
        </button>
      }
    </div>
  `,
  styleUrl: './game-activity-feed.component.scss'
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
