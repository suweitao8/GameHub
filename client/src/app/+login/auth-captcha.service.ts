import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor } from '@app/core'
import { catchError } from 'rxjs/operators'
import { environment } from '../../environments/environment'

export interface AuthCaptchaChallenge {
  captchaId: string
  svg: string
}

@Injectable({ providedIn: 'root' })
export class AuthCaptchaService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)

  getCaptcha () {
    return this.authHttp.get<AuthCaptchaChallenge>(environment.apiUrl + '/api/v1/users/captcha')
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }
}
