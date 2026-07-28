import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import {
  GameFollowedAuthor,
  GameLevelInfo,
  GameList,
  GameNotification
} from '@peertube/peertube-models'
import { map, Observable } from 'rxjs'
import { environment } from '../../../environments/environment'
import { normalizeGameList } from './game-helpers'

@Injectable({ providedIn: 'root' })
export class GamePersonalService {
  private readonly http = inject(HttpClient)

  private static readonly BASE_URL = `${environment.apiUrl}/api/v1/games`

  listFavorites (): Observable<GameList> {
    return this.http.get<GameList>(`${GamePersonalService.BASE_URL}/me/favorites`).pipe(map(normalizeGameList))
  }

  listRecent (): Observable<GameList> {
    return this.http.get<GameList>(`${GamePersonalService.BASE_URL}/me/recent`).pipe(map(normalizeGameList))
  }

  listOwned (): Observable<GameList> {
    return this.http.get<GameList>(`${GamePersonalService.BASE_URL}/me/owned`).pipe(map(normalizeGameList))
  }

  notifications (): Observable<{ total: number, unread: number, data: GameNotification[] }> {
    return this.http.get<{ total: number, unread: number, data: GameNotification[] }>(
      `${GamePersonalService.BASE_URL}/me/notifications`
    )
  }

  markNotificationRead (id: number): Observable<unknown> {
    return this.http.put(`${GamePersonalService.BASE_URL}/me/notifications/${id}/read`, {})
  }

  markAllNotificationsRead (): Observable<unknown> {
    return this.http.post(`${GamePersonalService.BASE_URL}/me/notifications/read-all`, {})
  }

  deleteNotification (id: number): Observable<unknown> {
    return this.http.delete(`${GamePersonalService.BASE_URL}/me/notifications/${id}`)
  }

  listFollowing (): Observable<{ total: number, data: GameFollowedAuthor[] }> {
    return this.http.get<{ total: number, data: GameFollowedAuthor[] }>(
      `${GamePersonalService.BASE_URL}/me/following`
    )
  }

  getUserLevel (): Observable<GameLevelInfo> {
    return this.http.get<GameLevelInfo>(`${GamePersonalService.BASE_URL}/me/level`)
  }

  claimDailyLogin (): Observable<{ claimed: boolean; exp: number; totalExp: number; levelInfo: GameLevelInfo['levelInfo'] }> {
    return this.http.post<{ claimed: boolean; exp: number; totalExp: number; levelInfo: GameLevelInfo['levelInfo'] }>(
      `${GamePersonalService.BASE_URL}/me/level/daily-login`, {}
    )
  }
}
