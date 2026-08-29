import { HttpHeaderResponse } from '@angular/common/http'
import { Injectable, LOCALE_ID, inject } from '@angular/core'
import { Router } from '@angular/router'
import { DateFormat, dateToHuman } from '@app/helpers'
import { HttpStatusCode, HttpStatusCodeType, ResultList } from '@peertube/peertube-models'
import { PeerTubeHTTPError, PeerTubeReconnectError } from '@root-helpers/errors'
import { throwError as observableThrowError } from 'rxjs'

@Injectable()
export class RestExtractor {
  private localeId = inject(LOCALE_ID)
  private router = inject(Router)

  applyToResultListData<T, U> (
    result: ResultList<T>,
    fun: (data: T) => U
  ): ResultList<U> {
    const data: T[] = result.data

    return {
      total: result.total,
      data: data.map(d => fun(d))
    }
  }

  convertResultListDateToHuman<T> (
    result: ResultList<T>,
    fieldsToConvert: string[] = [ 'createdAt' ],
    format?: DateFormat
  ): ResultList<T> {
    return this.applyToResultListData(result, data => this.convertDateToHuman(data, fieldsToConvert, format))
  }

  convertDateToHuman (target: any, fieldsToConvert: string[], format?: DateFormat) {
    fieldsToConvert.forEach(field => {
      if (!target[field]) return

      target[field] = dateToHuman(this.localeId, new Date(target[field]), format)
    })

    return target
  }

  redirectTo404IfNotFound (
    obj: { status: HttpStatusCodeType },
    type: 'video' | 'other',
    status: HttpStatusCodeType[] = [ HttpStatusCode.NOT_FOUND_404 ]
  ) {
    if (obj?.status && status.includes(obj.status)) {
      // Do not use redirectService to avoid circular dependencies
      this.router.navigate([ '/404' ], { state: { type, obj }, skipLocationChange: true })
    }

    return observableThrowError(() => obj)
  }

  handleError (err: any) {
    const errorMessage = this.buildErrorMessage(err)

    const errorObj: { message: string, status: string, body: string, headers: HttpHeaderResponse } = {
      message: errorMessage,
      status: undefined,
      body: undefined,
      headers: err.headers
    }

    if (err.status) {
      errorObj.status = err.status
      errorObj.body = err.error
    }

    return observableThrowError(() => {
      if (err instanceof PeerTubeReconnectError) {
        return err
      }

      if (err.status) {
        return new PeerTubeHTTPError(errorMessage, {
          status: err.status,
          body: errorObj.body,
          headers: errorObj.headers,
          url: err.url
        })
      }

      return err
    })
  }

  private buildErrorMessage (err: any) {
    if (err.status !== undefined) return this.ensureChineseMessage(this.buildServerErrorMessage(err))
    if (err.error instanceof Error) return this.ensureChineseMessage(err.error.detail || err.error.title)
    if (typeof err.error === 'string') return this.ensureChineseMessage(err.error)
    if (typeof err === 'string') return this.ensureChineseMessage(err)

    return this.ensureChineseMessage(err.message || err.detail || $localize`未知错误`)
  }

  private buildServerErrorMessage (err: any) {
    // A server-side error occurred.
    if (err.error?.errors) {
      const errors = err.error.errors

      return Object.keys(errors)
        .map(key => errors[key].msg)
        .join('. ')
    }

    if (err.status === HttpStatusCode.PAYLOAD_TOO_LARGE_413) {
      return $localize`媒体文件过大，无法上传到服务器。如需提高大小限制，请联系管理员。`
    }

    if (err.status === HttpStatusCode.TOO_MANY_REQUESTS_429) {
      const secondsLeft = err.headers.get('retry-after')

      if (secondsLeft) {
        const minutesLeft = Math.floor(parseInt(secondsLeft, 10) / 60)
        return $localize`操作次数过多，请在 ${minutesLeft} 分钟后重试。`
      }

      return $localize`操作次数过多，请稍后重试。`
    }

    if (err.status === HttpStatusCode.INTERNAL_SERVER_ERROR_500) {
      return $localize`服务器错误，请稍后重试。`
    }

    if (err.status === HttpStatusCode.BAD_GATEWAY_502) {
      return $localize`服务器暂时不可用，请稍后重试。`
    }

    return err.error?.error || err.error?.detail || err.error?.title || $localize`未知服务器错误`
  }

  private ensureChineseMessage (message: unknown) {
    if (typeof message !== 'string' || !message.trim()) return $localize`未知错误`
    if (/[\u4e00-\u9fff]/.test(message)) return message

    const knownMessages: Record<string, string> = {
      'Bad Gateway': $localize`服务器暂时不可用，请稍后重试。`,
      'Forbidden': $localize`当前账号没有权限进行这项操作。`,
      'Network Error': $localize`网络连接失败，请稍后重试。`,
      'Not Found': $localize`找不到相关内容。`,
      'Unauthorized': $localize`请先登录后再进行这项操作。`
    }

    return knownMessages[message.trim()] || $localize`请求失败，请稍后重试。`
  }
}
