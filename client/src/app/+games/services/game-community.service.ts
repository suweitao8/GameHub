import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import {
  GameComment,
  GameCommentList,
  GameChatMessage,
  GameCommunity,
  GameRelatedGame,
  GameReportResult,
  GameShareResult
} from '@peertube/peertube-models'
import { Observable } from 'rxjs'
import { environment } from '../../../environments/environment'

@Injectable({ providedIn: 'root' })
export class GameCommunityService {
  private readonly http = inject(HttpClient)

  private static readonly BASE_URL = `${environment.apiUrl}/api/v1/games`

  community (uuid: string): Observable<GameCommunity> {
    return this.http.get<GameCommunity>(`${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/community`)
  }

  comments (
    uuid: string,
    sort: 'hot' | 'new' | 'old' = 'hot',
    start = 0,
    count = 20
  ): Observable<GameCommentList> {
    return this.http.get<GameCommentList>(
      `${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/comments?sort=${sort}&start=${start}&count=${count}`
    )
  }

  discussion (uuid: string, start = 0, count = 50): Observable<{ total: number, data: GameChatMessage[] }> {
    return this.http.get<{ total: number, data: GameChatMessage[] }>(
      `${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/discussion?start=${start}&count=${count}`
    )
  }

  sendDiscussion (uuid: string, text: string): Observable<{ message: GameChatMessage }> {
    return this.http.post<{ message: GameChatMessage }>(
      `${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/discussion`, { text }
    )
  }

  related (uuid: string, count = 8): Observable<{ total: number, data: GameRelatedGame[] }> {
    return this.http.get<{ total: number, data: GameRelatedGame[] }>(
      `${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/related?count=${count}`
    )
  }

  replies (uuid: string, commentId: number): Observable<{ total: number, data: GameComment[] }> {
    return this.http.get<{ total: number, data: GameComment[] }>(
      `${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/comments/${commentId}/replies`
    )
  }

  rate (uuid: string, rating: 'like' | 'none'): Observable<unknown> {
    return this.http.put<unknown>(`${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/rate`, { rating })
  }

  favorite (uuid: string, favorite: boolean): Observable<{ favorite: boolean }> {
    return this.http.put<{ favorite: boolean }>(`${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/favorite`, { favorite })
  }

  follow (uuid: string, following: boolean): Observable<{ following: boolean }> {
    return this.http.put<{ following: boolean }>(`${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/follow`, { following })
  }

  followAuthor (accountId: number, following: boolean): Observable<{ following: boolean }> {
    return this.http.put<{ following: boolean }>(
      `${GameCommunityService.BASE_URL}/author/${encodeURIComponent(accountId)}/follow`, { following }
    )
  }

  comment (uuid: string, text: string, image?: File | null): Observable<{ comment: GameComment }> {
    const body = new FormData()
    body.append('text', text)
    if (image) body.append('image', image, image.name)
    return this.http.post<{ comment: GameComment }>(
      `${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/comments`, body)
  }

  reply (uuid: string, commentId: number, text: string, image?: File | null): Observable<{ comment: GameComment }> {
    const body = new FormData()
    body.append('text', text)
    if (image) body.append('image', image, image.name)
    return this.http.post<{ comment: GameComment }>(
      `${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/comments/${commentId}/reply`, body)
  }

  likeComment (uuid: string, commentId: number, liked: boolean): Observable<{ liked: boolean, likes: number }> {
    return this.http.put<{ liked: boolean, likes: number }>(
      `${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/comments/${commentId}/like`, { liked }
    )
  }

  deleteComment (uuid: string, commentId: number): Observable<unknown> {
    return this.http.delete(`${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/comments/${commentId}`)
  }

  coin (uuid: string, amount: 1 | 2): Observable<{ coins: number, coinBalance: number, coinsGiven: number }> {
    return this.http.post<{ coins: number, coinBalance: number, coinsGiven: number }>(
      `${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/coin`, { amount }
    )
  }

  share (uuid: string): Observable<GameShareResult> {
    return this.http.post<GameShareResult>(`${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/share`, {})
  }

  report (uuid: string, reason: string, predefinedReasons: string[] = []): Observable<GameReportResult> {
    return this.http.post<GameReportResult>(
      `${GameCommunityService.BASE_URL}/${encodeURIComponent(uuid)}/report`,
      { reason, predefinedReasons }
    )
  }
}
