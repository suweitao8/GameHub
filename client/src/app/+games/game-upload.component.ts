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
  readonly step = signal(1)
  readonly fileSize = signal(0)
  readonly coverPreview = signal('')

  onFileChange (event: Event) {
    this.file = (event.target as HTMLInputElement).files?.[0] || null
    this.fileSize.set(this.file?.size || 0)
    if (this.file && this.file.size > 20 * 1024 * 1024) {
      this.error.set('单文件 HTML 最大 20MB，请压缩后再试。')
      this.file = null
    } else this.error.set('')
  }

  onCoverChange (event: Event) {
    this.cover = (event.target as HTMLInputElement).files?.[0] || null
    this.setCoverPreview(this.cover)
  }

  async submit () {
    if (!this.file || !this.title.trim()) {
      this.error.set('请选择单文件 HTML 游戏并填写标题。')
      return
    }
    this.submitting.set(true)
    this.step.set(2)
    this.error.set('')
    this.message.set('')
    let cover = this.cover
    if (!cover) {
      this.step.set(4)
      cover = await this.generateAutomaticCover()
      this.cover = cover
      this.setCoverPreview(cover)
    }
    this.step.set(5)
    this.gamesService.create(this.file, {
      title: this.title.trim(),
      description: this.description.trim(),
      instructions: this.instructions.trim(),
      category: this.category.trim() || 'other',
      tags: this.tags,
      cover
    }).subscribe({
      next: game => {
        this.submitting.set(false)
        this.step.set(6)
        this.message.set(game.status === 'published' ? '上传成功，游戏已发布。' : '上传成功，等待管理员审核。')
      },
      error: () => {
        this.submitting.set(false)
        this.step.set(1)
        this.error.set('上传失败，请确认文件是自包含的 HTML 游戏。')
      }
    })
  }

  formatBytes (value: number) {
    return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`
  }

  async regenerateCover () {
    if (!this.title.trim()) {
      this.error.set('请先填写游戏名称，再生成封面。')
      return
    }

    this.error.set('')
    this.step.set(4)
    this.cover = await this.generateAutomaticCover()
    this.setCoverPreview(this.cover)
    this.step.set(5)
  }

  private setCoverPreview (file: File | null) {
    if (!file) {
      this.coverPreview.set('')
      return
    }

    const reader = new FileReader()
    reader.onload = () => this.coverPreview.set(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  private generateAutomaticCover (): Promise<File | null> {
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720
    const context = canvas.getContext('2d')
    if (!context) return Promise.resolve(null)

    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#e46f24')
    gradient.addColorStop(1, '#f6b76e')
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = 'rgba(255, 255, 255, .16)'
    for (let index = 0; index < 7; index++) context.fillRect(index * 220 - 100, 0, 80, canvas.height)
    context.fillStyle = '#fff'
    context.font = '800 72px Arial'
    context.fillText(this.title.trim() || 'GameHub 游戏', 72, 400)
    context.font = '600 28px Arial'
    context.fillText(`${this.category.toUpperCase()} · HTML GAME`, 76, 465)

    return new Promise(resolve => canvas.toBlob(blob => {
      resolve(blob ? new File([ blob ], 'gamehub-auto-cover.png', { type: 'image/png' }) : null)
    }, 'image/png'))
  }
}
