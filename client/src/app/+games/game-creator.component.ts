import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { GameCardComponent } from './game-card.component'
import { GameCreatorOverview, GameLevelInfo, GameNotification, GamesService } from './games.service'
import { GameLevelBadgeComponent } from './game-level-badge.component'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

@Component({
  templateUrl: './game-creator.component.html',
  styleUrl: './game-creator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GameCardComponent, RouterLink, GameLevelBadgeComponent, GlobalIconComponent ]
})
export class GameCreatorComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  private readonly router = inject(Router)
  readonly overview = signal<GameCreatorOverview | null>(null)
  readonly levelInfo = signal<GameLevelInfo | null>(null)
  readonly dailyLoginLoading = signal(false)
  readonly dailyLoginMessage = signal('')
  readonly error = signal('')
  readonly recentNotifications = signal<GameNotification[]>([])
  readonly trendLoading = signal(true)
  readonly trendError = signal(false)
  readonly trendPlays = signal<{ date: string; plays: number }[]>([])

  ngOnInit () {
    this.gamesService.creatorOverview().subscribe({
      next: value => this.overview.set(value),
      error: () => this.error.set('请先登录后进入创作中心。')
    })
    this.gamesService.getUserLevel().subscribe({
      next: value => this.levelInfo.set(value),
      error: () => { /* 等级数据加载失败不阻塞页面，静默处理 */ }
    })
    this.gamesService.notifications().subscribe({
      next: value => this.recentNotifications.set(value.data.filter(item => item.kind === 'comment' || item.kind === 'reply').slice(0, 5))
    })
    // Load play trend for the mini chart
    this.gamesService.getAnalytics().subscribe({
      next: data => {
        this.trendPlays.set(data.playTrend)
        this.trendLoading.set(false)
      },
      error: () => {
        this.trendError.set(true)
        this.trendLoading.set(false)
      }
    })
  }

  claimDaily () {
    if (this.dailyLoginLoading()) return
    this.dailyLoginLoading.set(true)
    this.dailyLoginMessage.set('')
    this.gamesService.claimDailyLogin().subscribe({
      next: result => {
        if (result.claimed) {
          this.dailyLoginMessage.set(`签到成功！+${result.exp} EXP`)
          this.levelInfo.update(li => li ? { ...li, exp: result.totalExp, levelInfo: result.levelInfo, dailyLoginAvailable: false } : li)
        } else {
          this.dailyLoginMessage.set('今日已签到')
        }
        this.dailyLoginLoading.set(false)
      },
      error: () => {
        this.dailyLoginMessage.set('签到失败，请重试')
        this.dailyLoginLoading.set(false)
      }
    })
  }

  formatBytes (bytes: number) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  trendMax () {
    const data = this.trendPlays()
    if (!data.length) return 1
    return Math.max(...data.map(t => t.plays), 1)
  }

  goToAnalytics () {
    void this.router.navigate([ '/games/analytics' ])
  }
}
