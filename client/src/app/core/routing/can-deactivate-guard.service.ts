import debug from 'debug'
import { Observable } from 'rxjs'
import { Injectable, inject } from '@angular/core'
import { ConfirmService } from '@app/core/confirm'

export type CanComponentDeactivateResult = {
  canDeactivate: Observable<boolean> | boolean
  text?: string
}

const debugLogger = debug('peertube:routing:CanComponentDeactivate')

export interface CanComponentDeactivate {
  canDeactivate: () => CanComponentDeactivateResult
}

@Injectable()
export class CanDeactivateGuard {
  private confirmService = inject(ConfirmService)

  canDeactivate (component: CanComponentDeactivate) {
    const result = component.canDeactivate()

    debugLogger('Checking if component can deactivate', result)
    if (result.canDeactivate) return true

    const text = result.text || $localize`所有未保存的数据都会丢失，确定要离开此页面吗？`

    return this.confirmService.confirm(
      text,
      $localize`警告`,
      {
        confirmButtonText: $localize`留在此页面`,
        cancelButtonText: $localize`离开页面`
      }
    ).then(result => !result) // Inverse the result, "stay on page" is the primary/default button so we don't leave the page by accident
  }
}
