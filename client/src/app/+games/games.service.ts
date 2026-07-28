import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import {
  Game,
  GameActivity,
  GameActivityList,
  GameAnalytics,
  GameAuthor,
  GameCollection,
  GameCollectionDetail,
  GameCollectionList,
  GameComment,
  GameCommentList,
  GameCommunity,
  GameCreatorOverview,
  GameEvent,
  GameEventList,
  GameFollowedAuthor,
  GameLevelInfo,
  GameList,
  GameNotification,
  GameNotificationList,
  GameRanking,
  GameRankingList,
  GameRatingDistribution,
  GameRelatedGame,
  GameReportResult,
  GameReservation,
  GameReservationList,
  GameReview,
  GameReviewList,
  GameShareResult,
  GameTripleResult
} from '@peertube/peertube-models'
import { catchError, map, shareReplay } from 'rxjs/operators'
import { Observable } from 'rxjs'
import { environment } from '../../environments/environment'
import { buildGameRuntimeUrl, buildGamesListUrl, buildGameUploadFormData, GameUploadMetadata, GamesListParams } from './games-api'

// Re-export 共享类型，供 +games 目录内组件沿用现有 import 路径（从 games.service 取类型）
export {
  Game,
  GameActivity,
  GameActivityList,
  GameAnalytics,
  GameAuthor,
  GameCollection,
  GameCollectionDetail,
  GameCollectionList,
  GameComment,
  GameCommentList,
  GameCommunity,
  GameCreatorOverview,
  GameEvent,
  GameEventList,
  GameFollowedAuthor,
  GameLevelInfo,
  GameList,
  GameNotification,
  GameNotificationList,
  GameRanking,
  GameRankingList,
  GameRatingDistribution,
  GameRelatedGame,
  GameReportResult,
  GameReservation,
  GameReservationList,
  GameReview,
  GameReviewList,
  GameShareResult,
  GameTripleResult
}

@Injectable({ providedIn: 'root' })
export class GamesService {
  private readonly http = inject(HttpClient)
  private readonly restExtractor = inject(RestExtractor)
  private readonly listCache = new Map<string, Observable<GameList>>()
  private readonly detailCache = new Map<string, Observable<Game>>()

  static readonly BASE_URL = `${environment.apiUrl}/api/v1/games`

  list (params: GamesListParams = {}): Observable<GameList> {
    const cacheKey = JSON.stringify(params)
    const cached = this.listCache.get(cacheKey)
    if (cached) return cached

    const request$ = this.http
      .get<GameList>(buildGamesListUrl(environment.apiUrl, params))
      .pipe(map(result => this.normalizeGameList(result)))
      .pipe(catchError(err => this.restExtractor.handleError(err)))
      .pipe(shareReplay({ bufferSize: 1, refCount: false, windowTime: 5000 }))

    this.listCache.set(cacheKey, request$)
    // Clean up cache entry after window time expires
    setTimeout(() => this.listCache.delete(cacheKey), 5500)
    return request$
  }

  get (uuid: string): Observable<Game> {
    const cached = this.detailCache.get(uuid)
    if (cached) return cached

    const request$ = this.http
      .get<Game>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}`)
      .pipe(map(game => this.normalizeGame(game)))
      .pipe(catchError(err => this.restExtractor.handleError(err)))
      .pipe(shareReplay({ bufferSize: 1, refCount: false, windowTime: 5000 }))

    this.detailCache.set(uuid, request$)
    setTimeout(() => this.detailCache.delete(uuid), 5500)
    return request$
  }

  recordPlay (uuid: string): Observable<{ runtimeUrl: string }> {
    return this.http
      .post<{ runtimeUrl: string }>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/play`, {})
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  community (uuid: string): Observable<GameCommunity> {
    return this.http.get<GameCommunity>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/community`)
  }

  comments (uuid: string, sort: 'hot' | 'new' | 'old' = 'hot', start = 0, count = 20): Observable<{ total: number, data: GameComment[] }> {
    return this.http.get<{ total: number, data: GameComment[] }>(
      `${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/comments?sort=${sort}&start=${start}&count=${count}`
    )
  }

  reviews (uuid: string, start = 0, count = 20): Observable<{ total: number, data: GameReview[] }> {
    return this.http.get<{ total: number, data: GameReview[] }>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/reviews?start=${start}&count=${count}`)
  }

  ratingDistribution (uuid: string): Observable<GameRatingDistribution> {
    return this.http.get<GameRatingDistribution>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/rating-distribution`)
  }

  related (uuid: string, count = 8): Observable<{ total: number, data: GameRelatedGame[] }> {
    return this.http.get<{ total: number, data: GameRelatedGame[] }>(
      `${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/related?count=${count}`
    )
  }

  replies (uuid: string, commentId: number): Observable<{ total: number, data: GameComment[] }> {
    return this.http.get<{ total: number, data: GameComment[] }>(
      `${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/comments/${commentId}/replies`
    )
  }

  rate (uuid: string, rating: 'like' | 'none'): Observable<unknown> {
    return this.http.put<unknown>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/rate`, { rating })
  }

  favorite (uuid: string, favorite: boolean): Observable<{ favorite: boolean }> {
    return this.http.put<{ favorite: boolean }>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/favorite`, { favorite })
  }

  follow (uuid: string, following: boolean): Observable<{ following: boolean }> {
    return this.http.put<{ following: boolean }>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/follow`, { following })
  }

  followAuthor (accountId: number, following: boolean): Observable<{ following: boolean }> {
    return this.http.put<{ following: boolean }>(`${GamesService.BASE_URL}/author/${encodeURIComponent(accountId)}/follow`, { following })
  }

  comment (uuid: string, text: string): Observable<{ comment: GameComment }> {
    return this.http.post<{ comment: GameComment }>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/comments`, { text })
  }

  review (uuid: string, score: number, text: string): Observable<{ review: GameReview }> {
    return this.http.put<{ review: GameReview }>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/review`, { score, text })
  }

  reply (uuid: string, commentId: number, text: string): Observable<{ comment: GameComment }> {
    return this.http.post<{ comment: GameComment }>(
      `${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/comments/${commentId}/reply`, { text })
  }

  likeComment (uuid: string, commentId: number, liked: boolean): Observable<{ liked: boolean, likes: number }> {
    return this.http.put<{ liked: boolean, likes: number }>(
      `${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/comments/${commentId}/like`, { liked }
    )
  }

  deleteComment (uuid: string, commentId: number): Observable<unknown> {
    return this.http.delete(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/comments/${commentId}`)
  }

  coin (uuid: string, amount: 1 | 2): Observable<{ coins: number, coinBalance: number, coinsGiven: number }> {
    return this.http.post<{ coins: number, coinBalance: number, coinsGiven: number }>(
      `${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/coin`, { amount })
  }

  triple (uuid: string): Observable<{ liked: boolean; coined: boolean; favorited: boolean }> {
    return this.http.post<{ liked: boolean; coined: boolean; favorited: boolean }>(
      `${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/triple`, {})
  }

  create (file: File, metadata: GameUploadMetadata): Observable<Game> {
    const body = buildGameUploadFormData(file, metadata)
    return this.http.post<Game>(GamesService.BASE_URL, body).pipe(map(game => this.normalizeGame(game)))
  }

  update (uuid: string, metadata: {
    title: string, description: string, instructions: string, category: string, tags: string, file?: File | null, cover?: File | null
  }): Observable<Game> {
    const body = new FormData()
    for (const [ key, value ] of Object.entries(metadata)) {
      if (value instanceof File) continue
      if (value !== null && value !== undefined) body.append(key, value)
    }
    if (metadata.file) body.append('gamefile', metadata.file, metadata.file.name)
    if (metadata.cover) body.append('coverfile', metadata.cover, metadata.cover.name)
    return this.http.put<Game>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}`, body).pipe(map(game => this.normalizeGame(game)))
  }

  remove (uuid: string): Observable<unknown> {
    return this.http.delete<unknown>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}`)
  }

  listFavorites (): Observable<GameList> {
    return this.http.get<GameList>(`${GamesService.BASE_URL}/me/favorites`).pipe(map(result => this.normalizeGameList(result)))
  }

  listRecent (): Observable<GameList> {
    return this.http.get<GameList>(`${GamesService.BASE_URL}/me/recent`).pipe(map(result => this.normalizeGameList(result)))
  }

  listOwned (): Observable<GameList> {
    return this.http.get<GameList>(`${GamesService.BASE_URL}/me/owned`).pipe(map(result => this.normalizeGameList(result)))
  }

  author (accountId: string, sort: 'latest' | 'plays' | 'favorites' = 'latest'): Observable<GameAuthor> {
    return this.http.get<GameAuthor>(`${GamesService.BASE_URL}/author/${encodeURIComponent(accountId)}?sort=${sort}`).pipe(
      map(result => ({ ...result, data: result.data.map(game => this.normalizeGame(game)) }))
    )
  }

  creatorOverview (): Observable<GameCreatorOverview> {
    return this.http.get<GameCreatorOverview>(`${GamesService.BASE_URL}/me/overview`).pipe(
      map(result => ({ ...result, games: result.games.map(game => this.normalizeGame(game)) }))
    )
  }

  notifications (): Observable<{ total: number, unread: number, data: GameNotification[] }> {
    return this.http.get<{ total: number, unread: number, data: GameNotification[] }>(`${GamesService.BASE_URL}/me/notifications`)
  }

  markNotificationRead (id: number): Observable<unknown> {
    return this.http.put(`${GamesService.BASE_URL}/me/notifications/${id}/read`, {})
  }

  markAllNotificationsRead (): Observable<unknown> {
    return this.http.post(`${GamesService.BASE_URL}/me/notifications/read-all`, {})
  }

  deleteNotification (id: number): Observable<unknown> {
    return this.http.delete(`${GamesService.BASE_URL}/me/notifications/${id}`)
  }

  listForModerators (): Observable<GameList> {
    return this.http.get<GameList>(`${GamesService.BASE_URL}/admin`)
  }

  moderate (uuid: string, action: 'approve' | 'reject' | 'block' | 'unlist', reason = ''): Observable<Game> {
    return this.http.post<Game>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/moderate`, { action, reason })
  }

  // User Level
  getUserLevel (): Observable<GameLevelInfo> {
    return this.http.get<GameLevelInfo>(`${GamesService.BASE_URL}/me/level`)
  }

  claimDailyLogin (): Observable<{ claimed: boolean; exp: number; totalExp: number; levelInfo: GameLevelInfo['levelInfo'] }> {
    return this.http.post<{ claimed: boolean; exp: number; totalExp: number; levelInfo: GameLevelInfo['levelInfo'] }>(
      `${GamesService.BASE_URL}/me/level/daily-login`, {}
    )
  }

  // Analytics
  getAnalytics (): Observable<GameAnalytics> {
    return this.http.get<GameAnalytics>(`${GamesService.BASE_URL}/me/analytics`)
  }

  // Rankings
  getRankings (kind: 'hot' | 'newest' | 'updated' | 'topRated' | 'favorites' | 'coins' | 'comments' | 'likes', count = 50, category?: string): Observable<{ kind: string; total: number; data: GameRanking[] }> {
    let url = `${GamesService.BASE_URL}/rankings?kind=${kind}&count=${count}`
    if (category) url += `&category=${encodeURIComponent(category)}`
    return this.http.get<{ kind: string; total: number; data: GameRanking[] }>(url)
  }

  // Feed
  getFeed (start = 0, count = 20): Observable<{ total: number; data: GameActivity[] }> {
    return this.http.get<{ total: number; data: GameActivity[] }>(`${GamesService.BASE_URL}/feed?start=${start}&count=${count}`)
  }

  getPublicFeed (start = 0, count = 20): Observable<{ total: number; data: GameActivity[] }> {
    return this.http.get<{ total: number; data: GameActivity[] }>(`${GamesService.BASE_URL}/feed/public?start=${start}&count=${count}`)
  }

  // Reservation
  reserve (uuid: string): Observable<{ id: number; gameId: number; createdAt: string }> {
    return this.http.post<{ id: number; gameId: number; createdAt: string }>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/reserve`, {})
  }

  cancelReserve (uuid: string): Observable<unknown> {
    return this.http.delete<unknown>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/reserve`)
  }

  listReservations (): Observable<{ total: number; data: { id: number; notified: boolean; createdAt: string; game: Game }[] }> {
    return this.http.get<{ total: number; data: { id: number; notified: boolean; createdAt: string; game: Game }[] }>(`${GamesService.BASE_URL}/me/reservations`)
  }

  // Featured
  getFeaturedGames (count = 10): Observable<GameList> {
    return this.http.get<GameList>(`${GamesService.BASE_URL}/featured?count=${count}`).pipe(map(result => this.normalizeGameList(result)))
  }

  // Following
  listFollowing (): Observable<{ total: number; data: GameFollowedAuthor[] }> {
    return this.http.get<{ total: number; data: GameFollowedAuthor[] }>(`${GamesService.BASE_URL}/me/following`)
  }

  // Share
  share (uuid: string): Observable<GameShareResult> {
    return this.http.post<GameShareResult>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/share`, {})
  }

  // Report
  report (uuid: string, reason: string, predefinedReasons: string[] = []): Observable<GameReportResult> {
    return this.http.post<GameReportResult>(
      `${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/report`,
      { reason, predefinedReasons }
    )
  }

  buildRuntimeUrl (runtimeOrigin: string, uuid: string) {
    return buildGameRuntimeUrl(runtimeOrigin, uuid)
  }

  buildDownloadUrl (uuid: string) {
    return `${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/download`
  }

  private normalizeGameList (result: GameList): GameList {
    return { ...result, data: result.data.map(game => this.normalizeGame(game)) }
  }

  private normalizeGame (game: Game): Game {
    if (!game.coverPath || typeof window === 'undefined') return game

    try {
      const coverUrl = new URL(game.coverPath, window.location.origin)
      if (coverUrl.pathname.startsWith('/api/v1/games/')) {
        return { ...game, coverPath: `${coverUrl.pathname}${coverUrl.search}` }
      }
    } catch {
      // Keep the server-provided path if it is not a valid URL.
    }

    return game
  }
}
