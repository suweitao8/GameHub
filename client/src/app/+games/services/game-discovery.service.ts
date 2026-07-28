import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import {
  GameActivity,
  GameList,
  GameRanking
} from '@peertube/peertube-models'
import { map, Observable } from 'rxjs'
import { environment } from '../../../environments/environment'
import { normalizeGameList } from './game-helpers'

@Injectable({ providedIn: 'root' })
export class GameDiscoveryService {
  private readonly http = inject(HttpClient)

  private static readonly BASE_URL = `${environment.apiUrl}/api/v1/games`

  getRankings (
    kind: 'hot' | 'newest' | 'updated' | 'topRated' | 'favorites' | 'coins' | 'comments' | 'likes',
    count = 50,
    category?: string
  ): Observable<{ kind: string; total: number; data: GameRanking[] }> {
    let url = `${GameDiscoveryService.BASE_URL}/rankings?kind=${kind}&count=${count}`
    if (category) url += `&category=${encodeURIComponent(category)}`
    return this.http.get<{ kind: string; total: number; data: GameRanking[] }>(url)
  }

  getFeed (start = 0, count = 20): Observable<{ total: number; data: GameActivity[] }> {
    return this.http.get<{ total: number; data: GameActivity[] }>(
      `${GameDiscoveryService.BASE_URL}/feed?start=${start}&count=${count}`
    )
  }

  getPublicFeed (start = 0, count = 20): Observable<{ total: number; data: GameActivity[] }> {
    return this.http.get<{ total: number; data: GameActivity[] }>(
      `${GameDiscoveryService.BASE_URL}/feed/public?start=${start}&count=${count}`
    )
  }

  getFeaturedGames (count = 10): Observable<GameList> {
    return this.http.get<GameList>(`${GameDiscoveryService.BASE_URL}/featured?count=${count}`).pipe(map(normalizeGameList))
  }
}
