import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import { catchError } from 'rxjs/operators'
import { Observable } from 'rxjs'
import { environment } from '../../environments/environment'
import { buildGameRuntimeUrl, buildGamesListUrl, GamesListParams } from './games-api'

export type Game = {
  uuid: string
  title: string
  description: string
  instructions: string
  category: string
  tags: string[]
  coverPath: string | null
  status: 'pending' | 'published' | 'rejected' | 'unlisted' | 'blocked'
  fileSizeBytes: number
  playCount: number
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  runtimeUrl: string
  ownerAccountId: number
}

export type GameList = {
  total: number
  data: Game[]
}

export type GameCommunity = {
  videoUuid: string | null
  likes: number
  dislikes: number
  comments: number
  rating: 'like' | 'dislike' | 'none'
  favorite: boolean
  following: boolean
  author: { id: number, name: string, displayName: string, handle: string } | null
}

export type GameComment = {
  id: number
  text: string
  createdAt: string
  account: { displayName: string, name: string }
}

@Injectable()
export class GamesService {
  private readonly http = inject(HttpClient)
  private readonly restExtractor = inject(RestExtractor)

  static readonly BASE_URL = `${environment.apiUrl}/api/v1/games`

  list (params: GamesListParams = {}): Observable<GameList> {
    return this.http
      .get<GameList>(buildGamesListUrl(environment.apiUrl, params))
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  get (uuid: string): Observable<Game> {
    return this.http
      .get<Game>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}`)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  recordPlay (uuid: string): Observable<{ runtimeUrl: string }> {
    return this.http
      .post<{ runtimeUrl: string }>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/play`, {})
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  community (uuid: string): Observable<GameCommunity> {
    return this.http.get<GameCommunity>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/community`)
  }

  comments (uuid: string): Observable<{ total: number, data: GameComment[] }> {
    return this.http.get<{ total: number, data: GameComment[] }>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/comments`)
  }

  rate (uuid: string, rating: 'like' | 'dislike' | 'none'): Observable<unknown> {
    return this.http.put<unknown>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/rate`, { rating })
  }

  favorite (uuid: string, favorite: boolean): Observable<{ favorite: boolean }> {
    return this.http.put<{ favorite: boolean }>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/favorite`, { favorite })
  }

  follow (uuid: string, following: boolean): Observable<{ following: boolean }> {
    return this.http.put<{ following: boolean }>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/follow`, { following })
  }

  comment (uuid: string, text: string): Observable<{ comment: GameComment }> {
    return this.http.post<{ comment: GameComment }>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/comments`, { text })
  }

  report (uuid: string, reason: string): Observable<{ abuse: { id: number } }> {
    return this.http.post<{ abuse: { id: number } }>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/report`, { reason })
  }

  create (file: File, metadata: {
    title: string, description: string, instructions: string, category: string, tags: string, cover?: File | null
  }): Observable<Game> {
    const body = new FormData()
    body.append('gamefile', file, file.name)
    if (metadata.cover) body.append('coverfile', metadata.cover, metadata.cover.name)
    for (const [ key, value ] of Object.entries(metadata)) body.append(key, value)
    return this.http.post<Game>(GamesService.BASE_URL, body)
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
    return this.http.put<Game>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}`, body)
  }

  remove (uuid: string): Observable<unknown> {
    return this.http.delete<unknown>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}`)
  }

  listFavorites (): Observable<GameList> {
    return this.http.get<GameList>(`${GamesService.BASE_URL}/me/favorites`)
  }

  listRecent (): Observable<GameList> {
    return this.http.get<GameList>(`${GamesService.BASE_URL}/me/recent`)
  }

  listOwned (): Observable<GameList> {
    return this.http.get<GameList>(`${GamesService.BASE_URL}/me/owned`)
  }

  listForModerators (): Observable<GameList> {
    return this.http.get<GameList>(`${GamesService.BASE_URL}/admin`)
  }

  moderate (uuid: string, action: 'approve' | 'reject' | 'block' | 'unlist', reason = ''): Observable<Game> {
    return this.http.post<Game>(`${GamesService.BASE_URL}/${encodeURIComponent(uuid)}/moderate`, { action, reason })
  }

  buildRuntimeUrl (runtimeOrigin: string, uuid: string) {
    return buildGameRuntimeUrl(runtimeOrigin, uuid)
  }
}
