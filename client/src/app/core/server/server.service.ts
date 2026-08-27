import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { HTMLServerConfig, ServerConfig, ServerStats } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { Observable, of } from 'rxjs'
import { share, tap } from 'rxjs/operators'
import { environment } from '../../../environments/environment'

@Injectable()
export class ServerService {
  private http = inject(HttpClient)

  private static BASE_CONFIG_URL = environment.apiUrl + '/api/v1/config/'
  private static BASE_STATS_URL = environment.apiUrl + '/api/v1/server/stats'

  private configObservable: Observable<ServerConfig>

  private configLoaded = false
  private config: ServerConfig
  private htmlConfig: HTMLServerConfig

  loadHTMLConfig () {
    try {
      this.loadHTMLConfigLocally()
    } catch (err) {
      // Expected in dev mode since we can't inject the config in the HTML
      if (environment.production !== false) {
        logger.error('Cannot load config locally. Fallback to API.')
      }

      return this.getConfig()
    }
  }

  getConfig () {
    if (this.configLoaded) return of(this.config)

    if (!this.configObservable) {
      this.configObservable = this.http.get<ServerConfig>(ServerService.BASE_CONFIG_URL)
        .pipe(
          tap(config => {
            this.config = config
            this.htmlConfig = config
            this.configLoaded = true
          }),
          share()
        )
    }

    return this.configObservable
  }

  getHTMLConfig () {
    return this.htmlConfig
  }

  getServerStats () {
    return this.http.get<ServerStats>(ServerService.BASE_STATS_URL)
  }

  private loadHTMLConfigLocally () {
    const configString = (window as any)['PeerTubeServerConfig']
    if (!configString) {
      throw new Error('Could not find PeerTubeServerConfig in HTML')
    }

    this.htmlConfig = JSON.parse(configString)
  }
}
