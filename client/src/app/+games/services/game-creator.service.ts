import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import {
  Game,
  GameAnalytics,
  GameAuthor,
  GameCreatorOverview,
  GameList
} from '@peertube/peertube-models'
import { map, Observable } from 'rxjs'
import { environment } from '../../../environments/environment'
import { normalizeGame } from './game-helpers'

@Injectable({ providedIn: 'root' })
export class GameCreatorService {
  private readonly http = inject(HttpClient)

  private static readonly BASE_URL = `${environment.apiUrl}/api/v1/games`

  author (accountId: string, sort: 'latest' | 'plays' | 'favorites' = 'latest'): Observable<GameAuthor> {
    return this.http.get<GameAuthor>(
      `${GameCreatorService.BASE_URL}/author/${encodeURIComponent(accountId)}?sort=${sort}`
    ).pipe(
      map(result => ({ ...result, data: result.data.map(game => normalizeGame(game)) }))
    )
  }

  creatorOverview (): Observable<GameCreatorOverview> {
    return this.http.get<GameCreatorOverview>(`${GameCreatorService.BASE_URL}/me/overview`).pipe(
      map(result => ({ ...result, games: result.games.map(game => normalizeGame(game)) }))
    )
  }

  getAnalytics (): Observable<GameAnalytics> {
    return this.http.get<GameAnalytics>(`${GameCreatorService.BASE_URL}/me/analytics`)
  }

  listForModerators (): Observable<GameList> {
    return this.http.get<GameList>(`${GameCreatorService.BASE_URL}/admin`)
  }

  moderate (uuid: string, action: 'approve' | 'reject' | 'block' | 'unlist', reason = ''): Observable<Game> {
    return this.http.post<Game>(
      `${GameCreatorService.BASE_URL}/${encodeURIComponent(uuid)}/moderate`, { action, reason }
    )
  }
}
