import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router, RouterLink, RouterLinkActive } from '@angular/router'

@Component({
  selector: 'my-game-navigation',
  templateUrl: './game-navigation.component.html',
  styleUrl: './game-navigation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ FormsModule, RouterLink, RouterLinkActive ]
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
