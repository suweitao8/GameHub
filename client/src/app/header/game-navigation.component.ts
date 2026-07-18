import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-game-navigation',
  templateUrl: './game-navigation.component.html',
  styleUrl: './game-navigation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ FormsModule, GlobalIconComponent ]
})
export class GameNavigationComponent {
  private readonly router = inject(Router)
  readonly query = signal('')

  submitSearch (event: Event) {
    event.preventDefault()
    const search = this.query().trim()
    void this.router.navigate([ '/games/search' ], { queryParams: search ? { search } : {} })
  }
}
