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
  GameChatMessage,
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
  GameRelatedGame,
  GameReportResult,
  GameReservation,
  GameReservationList,
  GameShareResult
} from '@peertube/peertube-models'
import { catchError, map, shareReplay } from 'rxjs/operators'
import { Observable } from 'rxjs'
import { environment } from '../../environments/environment'
import { buildGameRuntimeUrl, buildGamesListUrl, buildGameUploadFormData, GameUploadMetadata, GamesListParams } from './games-api'
import { normalizeGame, normalizeGameList } from './services/game-helpers'

// Re-export 共享类型，供 +games 目录内组件沿用现有 import 路径（从 games.service 取类型）
export type {
  Game,
  GameActivity,
  GameActivityList,
  GameAnalytics,
  GameAuthor,
  GameCollection,
  GameCollectionDetail,
  GameCollectionList,
  GameComment,
  GameChatMessage,
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
  GameRelatedGame,
  GameReportResult,
  GameReservation,
  GameReservationList,
  GameShareResult
}

// Re-export 领域 service，供新组件按需 inject（渐进迁移）
export { GameCommunityService } from './services/game-community.service'
export { GamePersonalService } from './services/game-personal.service'
export { GameDiscoveryService } from './services/game-discovery.service'
export { GameCreatorService } from './services/game-creator.service'
export { GameReservationService } from './services/game-reservation.service'

@Injectable({ providedIn: 'root' })
export class GamesService {
  private readonly http = inject(HttpClient)
  private readonly restExtractor = inject(RestExtractor)
  private readonly listCache = new Map<string, Observable<GameList>>()
  private readonly detailCache = new Map<string, Observable<Game>>()

  static readonly BASE_URL = `${environment.apiUrl}/api/v1/games`

  // ---------------------------------------------------------------------------
  // 核心 CRUD + 缓存
  // ---------------------------------------------------------------------------

  list (params: GamesListParams = {}): Observable<GameList> {
    const cacheKey = JSON.stringify(params)
    const cached = this.listCache.get(cacheKey)
    if (cached) return cached

    const request$ = this.http
      .get<GameList>(buildGamesListUrl(environment.apiUrl, params))
      .pipe(map(normalizeGameList))
      .pipe(catchError(err => this.restExtractor.handleError(err)))
      .pipe(shareReplay({ bufferSize: 1, refCount: false, windowTime: 5000 }))

    this.listCache.set(cacheKey, request$)
    setTimeout(() => this.listCache.delete(cacheKey), 5500)
    return request$
  }

  get (uuid: string): Observable<Game> {
    const cached = this.detailCache.get(uuid)
    if (cached) return cached

    const request$ = this.http
      .get<Game>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}`)
      .pipe(map(normalizeGame))
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

  create (file: File, metadata: GameUploadMetadata): Observable<Game> {
    const body = buildGameUploadFormData(file, metadata)
    return this.http.post<Game>(GamesService.BASE_URL, body).pipe(map(normalizeGame))
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
    return this.http.put<Game>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}`, body).pipe(map(normalizeGame))
  }

  remove (uuid: string): Observable<unknown> {
    return this.http.delete<unknown>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}`)
  }

  buildRuntimeUrl (runtimeOrigin: string, uuid: string) {
    return buildGameRuntimeUrl(runtimeOrigin, uuid)
  }

  // ---------------------------------------------------------------------------
  // 社区互动（委托 GameCommunityService，新组件应直接 inject 该 service）
  // ---------------------------------------------------------------------------

  community (uuid: string): Observable<GameCommunity> {
    return this.http.get<GameCommunity>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/community`)
  }

  comments (uuid: string, sort: 'hot' | 'new' | 'old' = 'hot', start = 0, count = 20): Observable<{ total: number, data: GameComment[] }> {
    return this.http.get<{ total: number, data: GameComment[] }>(
      `${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/comments?sort=${sort}&start=${start}&count=${count}`
    )
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

  comment (uuid: string, text: string, image?: File | null): Observable<{ comment: GameComment }> {
    const body = new FormData()
    body.append('text', text)
    if (image) body.append('image', image, image.name)
    return this.http.post<{ comment: GameComment }>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/comments`, body)
  }

  reply (uuid: string, commentId: number, text: string, image?: File | null): Observable<{ comment: GameComment }> {
    const body = new FormData()
    body.append('text', text)
    if (image) body.append('image', image, image.name)
    return this.http.post<{ comment: GameComment }>(
      `${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/comments/${commentId}/reply`, body)
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

  share (uuid: string): Observable<GameShareResult> {
    return this.http.post<GameShareResult>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/share`, {})
  }

  report (uuid: string, reason: string, predefinedReasons: string[] = []): Observable<GameReportResult> {
    return this.http.post<GameReportResult>(
      `${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/report`,
      { reason, predefinedReasons }
    )
  }

  // ---------------------------------------------------------------------------
  // 个人中心（委托 GamePersonalService）
  // ---------------------------------------------------------------------------

  listFavorites (): Observable<GameList> {
    return this.http.get<GameList>(`${GamesService.BASE_URL}/me/favorites`).pipe(map(normalizeGameList))
  }

  listRecent (): Observable<GameList> {
    return this.http.get<GameList>(`${GamesService.BASE_URL}/me/recent`).pipe(map(normalizeGameList))
  }

  listOwned (): Observable<GameList> {
    return this.http.get<GameList>(`${GamesService.BASE_URL}/me/owned`).pipe(map(normalizeGameList))
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

  listFollowing (): Observable<{ total: number, data: GameFollowedAuthor[] }> {
    return this.http.get<{ total: number, data: GameFollowedAuthor[] }>(`${GamesService.BASE_URL}/me/following`)
  }

  getUserLevel (): Observable<GameLevelInfo> {
    return this.http.get<GameLevelInfo>(`${GamesService.BASE_URL}/me/level`)
  }

  claimDailyLogin (): Observable<{ claimed: boolean; exp: number; totalExp: number; levelInfo: GameLevelInfo['levelInfo'] }> {
    return this.http.post<{ claimed: boolean; exp: number; totalExp: number; levelInfo: GameLevelInfo['levelInfo'] }>(
      `${GamesService.BASE_URL}/me/level/daily-login`, {}
    )
  }

  // ---------------------------------------------------------------------------
  // 发现（委托 GameDiscoveryService）
  // ---------------------------------------------------------------------------

  getRankings (
    kind: 'hot' | 'newest' | 'updated' | 'favorites' | 'coins' | 'comments' | 'likes',
    count = 50,
    category?: string
  ): Observable<{ kind: string; total: number; data: GameRanking[] }> {
    let url = `${GamesService.BASE_URL}/rankings?kind=${kind}&count=${count}`
    if (category) url += `&category=${encodeURIComponent(category)}`
    return this.http.get<{ kind: string; total: number; data: GameRanking[] }>(url)
  }

  getFeed (start = 0, count = 20): Observable<{ total: number; data: GameActivity[] }> {
    return this.http.get<{ total: number; data: GameActivity[] }>(`${GamesService.BASE_URL}/feed?start=${start}&count=${count}`)
  }

  getPublicFeed (start = 0, count = 20): Observable<{ total: number; data: GameActivity[] }> {
    return this.http.get<{ total: number; data: GameActivity[] }>(`${GamesService.BASE_URL}/feed/public?start=${start}&count=${count}`)
  }

  getFeaturedGames (count = 10): Observable<GameList> {
    return this.http.get<GameList>(`${GamesService.BASE_URL}/featured?count=${count}`).pipe(map(normalizeGameList))
  }

  // ---------------------------------------------------------------------------
  // 创作者（委托 GameCreatorService）
  // ---------------------------------------------------------------------------

  author (accountId: string, sort: 'latest' | 'plays' | 'favorites' = 'latest'): Observable<GameAuthor> {
    return this.http.get<GameAuthor>(`${GamesService.BASE_URL}/author/${encodeURIComponent(accountId)}?sort=${sort}`).pipe(
      map(result => ({ ...result, data: result.data.map(game => normalizeGame(game)) }))
    )
  }

  creatorOverview (): Observable<GameCreatorOverview> {
    return this.http.get<GameCreatorOverview>(`${GamesService.BASE_URL}/me/overview`).pipe(
      map(result => ({ ...result, games: result.games.map(game => normalizeGame(game)) }))
    )
  }

  getAnalytics (): Observable<GameAnalytics> {
    return this.http.get<GameAnalytics>(`${GamesService.BASE_URL}/me/analytics`)
  }

  listForModerators (): Observable<GameList> {
    return this.http.get<GameList>(`${GamesService.BASE_URL}/admin`)
  }

  moderate (uuid: string, action: 'approve' | 'reject' | 'block' | 'unlist', reason = ''): Observable<Game> {
    return this.http.post<Game>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/moderate`, { action, reason })
  }

  // ---------------------------------------------------------------------------
  // 预约（委托 GameReservationService）
  // ---------------------------------------------------------------------------

  reserve (uuid: string): Observable<GameReservation> {
    return this.http.post<GameReservation>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/reserve`, {})
  }

  cancelReserve (uuid: string): Observable<unknown> {
    return this.http.delete<unknown>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/reserve`)
  }

  listReservations (): Observable<GameReservationList> {
    return this.http.get<GameReservationList>(`${GamesService.BASE_URL}/me/reservations`)
  }
}
