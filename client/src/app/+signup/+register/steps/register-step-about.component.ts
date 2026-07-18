import { Component, input, ChangeDetectionStrategy } from '@angular/core'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { ServerStats } from '@peertube/peertube-models'
import { DaysDurationFormatterPipe } from '../../../shared/shared-main/date/days-duration-formatter.pipe'

@Component({
  selector: 'my-register-step-about',
  templateUrl: './register-step-about.component.html',
  styleUrls: [ './register-step-about.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ DaysDurationFormatterPipe, AlertComponent ]
})
export class RegisterStepAboutComponent {
  readonly requiresApproval = input<boolean>(undefined)
  readonly videoUploadDisabled = input<boolean>(undefined)
  readonly serverStats = input<ServerStats>(undefined)

  readonly instanceName = 'GameHub'

  get averageResponseTime () {
    return this.serverStats()?.averageRegistrationRequestResponseTimeMs
  }
}
