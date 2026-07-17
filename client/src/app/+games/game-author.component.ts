import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { AuthService } from '@app/core/auth/auth.service'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { GameCardComponent } from './game-card.component'
import { GameAuthor, GamesService } from './games.service'

@Component({
  templateUrl: './game-author.component.html',
  styleUrl: './game-author.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ GameCardComponent, RouterLink ]
})
export class GameAuthorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute)
  private readonly gamesService = inject(GamesService)
  private readonly authService = inject(AuthService)
  private readonly router = inject(Router)
  readonly author = signal<GameAuthor | null>(null)
  readonly loading = signal(true)
  readonly error = signal(false)
  readonly followLoading = signal(false)

  ngOnInit () {
    this.route.paramMap.subscribe(params => {
      const accountId = params.get('accountId')
      if (!accountId) return
      this.gamesService.author(accountId).subscribe({
        next: value => { this.author.set(value); this.loading.set(false) },
        error: () => { this.error.set(true); this.loading.set(false) }
      })
    })
  }

  toggleFollow () {
    const current = this.author()
    if (!current || this.followLoading()) return
    if (!this.authService.isLoggedIn()) {
      void this.router.navigate([ '/login' ], { queryParams: { returnUrl: this.router.url } })
      return
    }
    this.followLoading.set(true)
    this.gamesService.followAuthor(current.account.id, !current.following).subscribe({
      next: result => {
        this.author.update(value => value ? { ...value, following: result.following } : value)
        this.followLoading.set(false)
      },
      error: () => this.followLoading.set(false)
    })
  }
}
