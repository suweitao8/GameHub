import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterLink } from '@angular/router'
import { UserNotificationsComponent } from '@app/shared/shared-notifications/user-notifications.component'

@Component({
  templateUrl: './game-notifications.component.html',
  styleUrl: './game-notifications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink, UserNotificationsComponent ]
})
export class GameNotificationsComponent {}
