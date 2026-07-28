import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import type { Game, GameReservation, GameReservationList } from '@peertube/peertube-models'
import { Observable } from 'rxjs'
import { environment } from '../../../environments/environment'

@Injectable({ providedIn: 'root' })
export class GameReservationService {
  private readonly http = inject(HttpClient)

  private static readonly BASE_URL = `${environment.apiUrl}/api/v1/games`

  reserve (uuid: string): Observable<GameReservation> {
    return this.http.post<GameReservation>(
      `${GameReservationService.BASE_URL}/${encodeURIComponent(uuid)}/reserve`, {}
    )
  }

  cancelReserve (uuid: string): Observable<unknown> {
    return this.http.delete<unknown>(`${GameReservationService.BASE_URL}/${encodeURIComponent(uuid)}/reserve`)
  }

  listReservations (): Observable<GameReservationList> {
    return this.http.get<GameReservationList>(`${GameReservationService.BASE_URL}/me/reservations`)
  }
}
