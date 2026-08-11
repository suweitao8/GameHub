import { ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, inject, OnDestroy, signal, ViewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { Game, GamesService } from './games.service'
import { isSupportedGameRuntimeFilename } from './games-api'
import { CoverGeneratorService } from './services/cover-generator.service'
import { inspectGameHtml } from './shared/game-html-inspector'

const MAX_GAME_FILE_SIZE = 20 * 1024 * 1024
const MAX_COVER_FILE_SIZE = 2 * 1024 * 1024
const ACCEPTED_COVER_TYPES = [ 'image/png', 'image/jpeg', 'image/webp' ]

@Component({
  templateUrl: './game-upload.component.html',
  styleUrl: './game-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ FormsModule, RouterLink ]
})
export class GameUploadComponent implements OnDestroy {
  private readonly gamesService = inject(GamesService)
  private readonly coverGenerator = inject(CoverGeneratorService)
  @ViewChild('uploadDropZone') private uploadDropZone?: ElementRef<HTMLDivElement>

  file: File | null = null
  cover: File | null = null

  readonly title = signal('')
  readonly category = signal('other')
  readonly tags = signal('')
  readonly description = signal('')
  readonly instructions = signal('')
  readonly detectionNote = signal('')
  readonly coverError = signal('')
  readonly coverPreview = signal('')

  readonly submitting = signal(false)
  readonly message = signal('')
  readonly error = signal('')
  readonly fileSize = signal(0)
  readonly createdGame = signal<Game | null>(null)
  readonly dragActive = signal(false)

  readonly tagCount = computed(() => this.tags().split(',').filter(t => t.trim()).length)
  readonly isValid = computed(() => this.title().trim().length > 0 && this.category().trim().length > 0)
  readonly submittingMessage = computed(() => {
    if (this.submitting()) return '正在上传并检查…'
    if (!this.title().trim()) return '请填写标题'
    if (!this.category().trim()) return '请选择分类'
    return '提交游戏'
  })

  private fileGeneration = 0
  private inspectPromise: Promise<void> | null = null

  @HostListener('window:beforeunload', [ '$event' ])
  onBeforeUnload (event: BeforeUnloadEvent) {
    if (!this.hasUnsavedChanges()) return
    event.preventDefault()
    event.returnValue = '你有一个尚未提交的 HTML 游戏。'
    return event.returnValue
  }

  ngOnDestroy () {
    this.fileGeneration += 1
    this.resetCoverState()
  }

  onFileChange (event: Event) {
    const input = event.target as HTMLInputElement
    this.prepareSelectedFile(input.files?.[0] || null)
    input.value = ''
  }

  onFilePickerKeydown (event: KeyboardEvent, input: HTMLInputElement) {
    if (this.submitting()) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    input.click()
  }

  onFileDrop (event: DragEvent) {
    this.dragActive.set(false)
    if (this.submitting()) return

    const files = event.dataTransfer?.files
    if (!files?.length) return
    if (files.length > 1) {
      this.error.set('一次只能投稿一个 HTML 文件。')
      return
    }

    this.prepareSelectedFile(files[0])
  }

  removeFile () {
    if (this.submitting()) return
    this.resetForNewFile()
    this.uploadDropZone?.nativeElement.focus()
  }

  onCoverChange (event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0] || null
    input.value = ''
    this.selectCover(file)
  }

  removeCover () {
    if (this.submitting()) return
    this.cover = null
    this.coverError.set('')
    this.coverGenerator.coverPreview.set('')
    this.coverGenerator.coverSource.set('generated')
    this.coverPreview.set('')
  }

  async submit () {
    const file = this.file
    if (!file) {
      this.error.set('请选择一个 HTML 文件。')
      return
    }
    if (this.submitting()) return
    if (!this.isValid()) {
      this.error.set('请填写游戏标题并选择分类。')
      return
    }

    this.submitting.set(true)
    this.error.set('')
    this.message.set('')
    this.createdGame.set(null)

    await this.inspectPromise
    if (this.file !== file) {
      this.submitting.set(false)
      return
    }

    const title = this.title().trim()
    // 用户手动上传的封面优先,否则自动生成兜底
    let cover: File | null = this.cover
    if (!cover) {
      try {
        cover = await this.coverGenerator.generateAutomaticCover(title)
      } catch {
        // 自动封面是可选项,失败时仍允许提交
      }
    }

    if (this.file !== file) {
      this.submitting.set(false)
      return
    }

    this.gamesService.create(file, {
      title,
      description: this.description().trim(),
      instructions: this.instructions().trim(),
      category: this.category().trim(),
      tags: this.tags(),
      cover
    }).subscribe({
      next: game => {
        this.submitting.set(false)
        this.createdGame.set(game)
        this.message.set(game.status === 'published' ? '上传成功，游戏已发布。' : '上传成功，等待管理员审核。')
      },
      error: error => {
        this.submitting.set(false)
        this.error.set(this.getUploadError(error) || '上传失败，请检查游戏文件和资源引用。')
      }
    })
  }

  formatBytes (value: number) {
    return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`
  }

  private prepareSelectedFile (file: File | null) {
    this.resetForNewFile()
    if (!file) return

    if (!isSupportedGameRuntimeFilename(file.name.trim())) {
      this.error.set('只支持单个 .html 或 .htm 文件。')
      return
    }
    if (file.size > MAX_GAME_FILE_SIZE) {
      this.error.set('HTML 文件不能超过 20MB。')
      return
    }

    this.file = file
    this.fileSize.set(file.size)
    const generation = this.fileGeneration
    this.title.set(this.getFilenameTitle(file.name))
    this.inspectPromise = this.readHtmlMetadata(file, generation)
  }

  private async readHtmlMetadata (file: File, generation: number) {
    try {
      const source = await file.text()
      if (generation !== this.fileGeneration || this.file !== file) return

      const inspection = inspectGameHtml(source)
      // 仅在字段为空时自动填充,不覆盖用户已输入的内容
      if (inspection.title && !this.title().trim()) this.title.set(inspection.title)
      if (inspection.instructions && !this.instructions().trim()) {
        this.instructions.set(inspection.instructions)
      }
      this.detectionNote.set(inspection.detectionNote || '')
    } catch {
      // 解析失败不影响投稿,标题已有文件名兜底
    }
  }

  private selectCover (file: File | null) {
    this.coverError.set('')
    if (!file) return

    if (!ACCEPTED_COVER_TYPES.includes(file.type)) {
      this.coverError.set('封面只支持 PNG / JPEG / WebP 格式。')
      return
    }
    if (file.size > MAX_COVER_FILE_SIZE) {
      this.coverError.set('封面文件不能超过 2MB。')
      return
    }

    this.cover = file
    this.coverGenerator.setCoverPreview(file)
    this.coverGenerator.coverSource.set('manual')
    this.coverPreview.set(this.coverGenerator.coverPreview())
  }

  private getFilenameTitle (filename: string) {
    const title = filename.replace(/\.[^.]+$/, '').replace(/[_.-]+/g, ' ').trim()
    return this.normalizeTitle(title || '未命名游戏') || '未命名游戏'
  }

  private resetForNewFile () {
    this.fileGeneration += 1
    this.file = null
    this.inspectPromise = null
    this.title.set('')
    this.category.set('other')
    this.tags.set('')
    this.description.set('')
    this.instructions.set('')
    this.detectionNote.set('')
    this.fileSize.set(0)
    this.dragActive.set(false)
    this.error.set('')
    this.message.set('')
    this.createdGame.set(null)
    this.resetCoverState()
  }

  private hasUnsavedChanges () {
    return (!!this.file || !!this.cover) && !this.submitting() && !this.createdGame()
  }

  private resetCoverState () {
    this.cover = null
    this.coverError.set('')
    this.coverPreview.set('')
    this.coverGenerator.coverPreview.set('')
    this.coverGenerator.coverSource.set('generated')
  }

  private normalizeTitle (value: string) {
    const normalized = value
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/\p{Cc}/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120)

    return /<script\b|javascript:|on\w+\s*=|data:text\/html/i.test(normalized) ? '' : normalized
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
