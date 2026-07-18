import { HttpClient } from '@angular/common/http'
import { Injectable, inject, signal } from '@angular/core'
import { AuthService } from '@app/core/auth/auth.service'
import { environment } from '../../environments/environment'

type GameNotificationSummary = { unread: number }

@Injectable({ providedIn: 'root' })
export class GameNotificationBadgeService {
  private readonly http = inject(HttpClient)
  private readonly authService = inject(AuthService)
  readonly unread = signal(0)

  constructor () {
    if (this.authService.isLoggedIn()) this.refresh()
    this.authService.loginChangedSource.subscribe(() => this.refresh())
  }

  refresh () {
    if (!this.authService.isLoggedIn()) {
      this.unread.set(0)
      return
    }

    this.http.get<GameNotificationSummary>(`${environment.apiUrl}/api/v1/games/me/notifications`).subscribe({
      next: result => this.unread.set(Math.max(0, result.unread || 0)),
      error: () => undefined
    })
  }

  setUnread (value: number) {
    this.unread.set(Math.max(0, value))
  }

  decrement () {
    this.unread.update(value => Math.max(0, value - 1))
  }

  clear () {
    this.unread.set(0)
  }
}
