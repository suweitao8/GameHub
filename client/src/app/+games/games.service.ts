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

// Re-export 领域 service，便于组件按需 inject（向后兼容渐进迁移）
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

  // 领域 service（通过 facade 暴露给现有组件，保持向后兼容）
  readonly communityService = inject(GameCommunityService)
  readonly personalService = inject(GamePersonalService)
  readonly discoveryService = inject(GameDiscoveryService)
  readonly creatorService = inject(GameCreatorService)
  readonly reservationService = inject(GameReservationService)

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

  // ---------------------------------------------------------------------------
  // URL 构建辅助
  // ---------------------------------------------------------------------------

  buildRuntimeUrl (runtimeOrigin: string, uuid: string) {
    return buildGameRuntimeUrl(runtimeOrigin, uuid)
  }

  buildDownloadUrl (uuid: string) {
    return `${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/download`
  }

  // ---------------------------------------------------------------------------
  // 领域委托（facade）— 保持现有组件调用兼容，渐进迁移到领域 service
  // ---------------------------------------------------------------------------

  // Community
  community = this.communityService.community.bind(this.communityService)
  comments = this.communityService.comments.bind(this.communityService)
  reviews = this.communityService.reviews.bind(this.communityService)
  ratingDistribution = this.communityService.ratingDistribution.bind(this.communityService)
  related = this.communityService.related.bind(this.communityService)
  replies = this.communityService.replies.bind(this.communityService)
  rate = this.communityService.rate.bind(this.communityService)
  favorite = this.communityService.favorite.bind(this.communityService)
  follow = this.communityService.follow.bind(this.communityService)
  followAuthor = this.communityService.followAuthor.bind(this.communityService)
  comment = this.communityService.comment.bind(this.communityService)
  review = this.communityService.review.bind(this.communityService)
  reply = this.communityService.reply.bind(this.communityService)
  likeComment = this.communityService.likeComment.bind(this.communityService)
  deleteComment = this.communityService.deleteComment.bind(this.communityService)
  coin = this.communityService.coin.bind(this.communityService)
  triple = this.communityService.triple.bind(this.communityService)
  share = this.communityService.share.bind(this.communityService)
  report = this.communityService.report.bind(this.communityService)

  // Personal
  listFavorites = this.personalService.listFavorites.bind(this.personalService)
  listRecent = this.personalService.listRecent.bind(this.personalService)
  listOwned = this.personalService.listOwned.bind(this.personalService)
  notifications = this.personalService.notifications.bind(this.personalService)
  markNotificationRead = this.personalService.markNotificationRead.bind(this.personalService)
  markAllNotificationsRead = this.personalService.markAllNotificationsRead.bind(this.personalService)
  deleteNotification = this.personalService.deleteNotification.bind(this.personalService)
  listFollowing = this.personalService.listFollowing.bind(this.personalService)
  getUserLevel = this.personalService.getUserLevel.bind(this.personalService)
  claimDailyLogin = this.personalService.claimDailyLogin.bind(this.personalService)

  // Discovery
  getRankings = this.discoveryService.getRankings.bind(this.discoveryService)
  getFeed = this.discoveryService.getFeed.bind(this.discoveryService)
  getPublicFeed = this.discoveryService.getPublicFeed.bind(this.discoveryService)
  getFeaturedGames = this.discoveryService.getFeaturedGames.bind(this.discoveryService)

  // Creator
  author = this.creatorService.author.bind(this.creatorService)
  creatorOverview = this.creatorService.creatorOverview.bind(this.creatorService)
  getAnalytics = this.creatorService.getAnalytics.bind(this.creatorService)
  listForModerators = this.creatorService.listForModerators.bind(this.creatorService)
  moderate = this.creatorService.moderate.bind(this.creatorService)

  // Reservation
  reserve = this.reservationService.reserve.bind(this.reservationService)
  cancelReserve = this.reservationService.cancelReserve.bind(this.reservationService)
  listReservations = this.reservationService.listReservations.bind(this.reservationService)
}
