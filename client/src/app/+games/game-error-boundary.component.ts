import { ChangeDetectionStrategy, Component, signal } from '@angular/core'

@Component({
  selector: 'my-game-error-boundary',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameErrorBoundaryComponent {
  readonly hasError = signal(false)
  readonly errorMessage = signal('')

  handleError (error: Error) {
    this.hasError.set(true)
    this.errorMessage.set(error.message || '游戏运行时发生错误')
    console.error('[GameErrorBoundary]', error)
  }

  reset () {
    this.hasError.set(false)
    this.errorMessage.set('')
  }
}
