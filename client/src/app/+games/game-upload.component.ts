import { ChangeDetectionStrategy, Component, HostListener, inject, OnDestroy, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { Game, GamesService } from './games.service'
import { CoverGeneratorService } from './services/cover-generator.service'
import { GamePreviewProbeService } from './services/game-preview-probe.service'

@Component({
  templateUrl: './game-upload.component.html',
  styleUrl: './game-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ FormsModule, RouterLink ]
})
export class GameUploadComponent implements OnDestroy {
  private readonly gamesService = inject(GamesService)
  private readonly previewProbe = inject(GamePreviewProbeService)
  private readonly coverGenerator = inject(CoverGeneratorService)

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
  readonly fileSize = signal(0)
  readonly createdGame = signal<Game | null>(null)
  readonly uploadProgress = signal(0)
  readonly dragActive = signal(false)

  // Expose probe + cover service state to the template.
  readonly previewUrl = this.previewProbe.previewUrl
  readonly previewStatus = this.previewProbe.previewStatus
  readonly previewError = this.previewProbe.previewError
  readonly previewValidationError = this.previewProbe.error
  readonly step = this.previewProbe.step
  readonly coverPreview = this.coverGenerator.coverPreview
  readonly coverSource = this.coverGenerator.coverSource
  private previewGeneration = 0

  @HostListener('window:beforeunload', [ '$event' ])
  onBeforeUnload (event: BeforeUnloadEvent) {
    if (!this.hasUnsavedChanges()) return
    event.preventDefault()
    event.returnValue = '你有未保存的修改，确定离开吗？'
    return event.returnValue
  }

  ngOnDestroy () {
    // Both services are root-scoped, so clear their state when this route is
    // destroyed. Otherwise a later upload can briefly render an old cover.
    this.previewGeneration += 1
    this.previewProbe.reset()
    this.resetCoverState()
  }

  onFileChange (event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) this.prepareSelectedFile(file)
  }

  onFileDrop (event: DragEvent) {
    this.dragActive.set(false)
    const file = event.dataTransfer?.files?.[0]
    if (!file) return

    this.prepareSelectedFile(file)
  }

  onCoverChange (event: Event) {
    const cover = (event.target as HTMLInputElement).files?.[0] || null
    this.cover = cover
    if (!cover) {
      this.coverGenerator.coverSource.set('generated')
      this.coverGenerator.setCoverPreview(null)
      return
    }

    this.coverGenerator.coverSource.set('manual')
    this.coverGenerator.setCoverPreview(cover)
  }

  async regenerateCover () {
    if (!this.title.trim()) {
      this.error.set('请先填写游戏名称，再生成封面。')
      return
    }

    this.error.set('')
    this.step.set(4)
    this.previewStatus.set('正在生成封面…')
    this.cover = await this.coverGenerator.regenerateCover(this.title, this.previewProbe.runtimeScreenshot())
    this.step.set(5)
    this.previewStatus.set('封面已生成')
  }

  onPreviewLoaded (event: Event) {
    this.previewProbe.onPreviewLoaded(event)
  }

  async submit () {
    if (!this.file || !this.title.trim()) {
      this.error.set('请选择单个 HTML 文件并填写标题。')
      return
    }
    this.submitting.set(true)
    this.uploadProgress.set(0)
    this.step.set(2)
    this.previewStatus.set('正在上传并检查文件…')
    this.uploadProgress.set(12)
    this.error.set('')
    this.message.set('')
    let cover = this.cover
    if (!cover) {
      this.step.set(4)
      this.previewStatus.set('正在生成封面…')
      this.uploadProgress.set(35)
      cover = await this.coverGenerator.generateAutomaticCover(this.title)
      this.cover = cover
    }
    this.step.set(5)
    this.previewStatus.set('正在提交审核…')
    this.uploadProgress.set(65)
    this.gamesService.create(this.file, {
      title: this.title.trim(),
      description: this.description.trim(),
      instructions: this.instructions.trim(),
      category: this.category.trim() || 'other',
      tags: this.tags,
      cover
    }).subscribe({
      next: game => {
        this.uploadProgress.set(100)
        this.submitting.set(false)
        this.step.set(6)
        this.previewStatus.set('上传成功')
        this.createdGame.set(game)
        this.message.set(game.status === 'published' ? '上传成功，游戏已发布。' : '上传成功，等待管理员审核。')
      },
      error: error => {
        this.uploadProgress.set(0)
        this.submitting.set(false)
        this.step.set(1)
        this.previewStatus.set('')
        this.error.set(this.getUploadError(error) || '上传失败，请检查游戏文件和资源引用。')
      }
    })
  }

  formatBytes (value: number) {
    return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`
  }

  precentsText () {
    return `上传中... ${this.uploadProgress()}%`
  }

  private resetForNewFile () {
    this.previewGeneration += 1
    this.file = null
    this.fileSize.set(0)
    this.error.set('')
    this.createdGame.set(null)
    this.cover = null
    this.resetCoverState()
    this.previewProbe.reset()
  }

  private prepareSelectedFile (file: File | null) {
    this.resetForNewFile()
    this.file = file
    this.fileSize.set(file?.size || 0)
    if (!file) return

    if (!/\.html?$/i.test(file.name.trim())) {
      this.error.set('只支持单个 .html 或 .htm 文件。')
      this.file = null
      this.fileSize.set(0)
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      this.error.set('HTML 文件不能超过 20MB。')
      this.file = null
      this.fileSize.set(0)
      return
    }

    const generation = this.previewGeneration
    void this.previewProbe.prepare(file, screenshot => this.finishPreview(screenshot, generation))
  }

  private hasUnsavedChanges () {
    if (this.submitting() || this.createdGame()) return false

    return !!this.file || !!this.cover || !!this.title.trim() || !!this.description.trim() ||
      !!this.instructions.trim() || !!this.tags.trim()
  }

  private async finishPreview (dataUrl: string | undefined, generation: number) {
    if (generation !== this.previewGeneration || !this.file || this.coverGenerator.coverSource() === 'manual') return

    this.step.set(4)
    this.previewStatus.set('正在生成封面…')
    const cover = dataUrl
      ? await this.coverGenerator.coverFromScreenshot(dataUrl, this.title)
      : await this.coverGenerator.generateAutomaticCover(this.title)
    if (generation !== this.previewGeneration || !this.file || this.coverGenerator.coverSource() === 'manual') return

    this.cover = cover
    this.coverGenerator.coverSource.set(dataUrl ? 'runtime' : 'generated')
    this.coverGenerator.setCoverPreview(this.cover)
    this.step.set(5)
    this.previewStatus.set(dataUrl ? '已生成运行截图封面' : '已生成 GameHub 封面')
  }

  private resetCoverState () {
    this.coverGenerator.coverPreview.set('')
    this.coverGenerator.coverSource.set('generated')
  }

  private getUploadError (error: unknown) {
    if (!error || typeof error !== 'object') return ''
    const candidate = error as { error?: { error?: string } | string, message?: string }
    const message = typeof candidate.error === 'object' && candidate.error?.error
      ? candidate.error.error
      : typeof candidate.error === 'string'
        ? candidate.error
        : candidate.message || ''
    return {
      'Each account can maintain at most 10 games': '每个账号最多维护 10 个游戏，请先下架旧作品。',
      'Upload rate limit reached': '上传操作过于频繁，请稍后再试。',
      'Account game storage quota reached': '游戏存储空间已用完，请先删除或下架旧作品。'
    }[message] || message
  }
}
