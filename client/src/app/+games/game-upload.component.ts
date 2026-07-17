import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { GamesService } from './games.service'

@Component({
  templateUrl: './game-upload.component.html',
  styleUrl: './game-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ FormsModule, RouterLink ]
})
export class GameUploadComponent {
  private readonly gamesService = inject(GamesService)
  file: File | null = null
  title = ''
  description = ''
  instructions = ''
  category = 'arcade'
  tags = ''
  cover: File | null = null
  readonly submitting = signal(false)
  readonly message = signal('')
  readonly error = signal('')

  onFileChange (event: Event) {
    this.file = (event.target as HTMLInputElement).files?.[0] || null
  }

  onCoverChange (event: Event) {
    this.cover = (event.target as HTMLInputElement).files?.[0] || null
  }

  submit () {
    if (!this.file || !this.title.trim()) {
      this.error.set('请选择单文件 HTML 游戏并填写标题。')
      return
    }
    this.submitting.set(true)
    this.error.set('')
    this.message.set('')
    this.gamesService.create(this.file, {
      title: this.title.trim(),
      description: this.description.trim(),
      instructions: this.instructions.trim(),
      category: this.category.trim() || 'other',
      tags: this.tags,
      cover: this.cover
    }).subscribe({
      next: game => {
        this.submitting.set(false)
        this.message.set(game.status === 'published' ? '上传成功，游戏已发布。' : '上传成功，等待管理员审核。')
      },
      error: () => {
        this.submitting.set(false)
        this.error.set('上传失败，请确认文件是自包含的 HTML 游戏。')
      }
    })
  }
}
