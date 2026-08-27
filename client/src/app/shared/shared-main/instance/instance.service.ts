import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor } from '@app/core'
import { About } from '@peertube/peertube-models'
import { Observable } from 'rxjs'
import { catchError, shareReplay } from 'rxjs/operators'
import { environment } from '../../../../environments/environment'

@Injectable()
export class InstanceService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)

  static BASE_CONFIG_URL = environment.apiUrl + '/api/v1/config'

  private aboutCache$: Observable<About> | null = null

  getAboutWithCache () {
    if (!this.aboutCache$) {
      this.aboutCache$ = this.authHttp.get<About>(InstanceService.BASE_CONFIG_URL + '/about')
        .pipe(
          catchError(res => this.restExtractor.handleError(res)),
          shareReplay(1)
        )

      setTimeout(() => {
        this.aboutCache$ = null
      }, 1000)
    }

    return this.aboutCache$
  }
}
