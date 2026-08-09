import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, OnDestroy, signal, ViewChild } from '@angular/core'
import { RouterLink } from '@angular/router'
import { Game, GamesService } from './games.service'
import { isSupportedGameRuntimeFilename } from './games-api'
import { CoverGeneratorService } from './services/cover-generator.service'

const MAX_GAME_FILE_SIZE = 20 * 1024 * 1024

@Component({
  templateUrl: './game-upload.component.html',
  styleUrl: './game-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink ]
})
export class GameUploadComponent implements OnDestroy {
  private readonly gamesService = inject(GamesService)
  private readonly coverGenerator = inject(CoverGeneratorService)
  @ViewChild('uploadDropZone') private uploadDropZone?: ElementRef<HTMLDivElement>

  file: File | null = null

  readonly title = signal('')
  readonly submitting = signal(false)
  readonly message = signal('')
  readonly error = signal('')
  readonly fileSize = signal(0)
  readonly createdGame = signal<Game | null>(null)
  readonly dragActive = signal(false)

  private fileGeneration = 0
  private titleReadPromise: Promise<void> | null = null

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

  async submit () {
    const file = this.file
    if (!file) {
      this.error.set('请选择一个 HTML 文件。')
      return
    }
    if (this.submitting()) return

    this.submitting.set(true)
    this.error.set('')
    this.message.set('')
    this.createdGame.set(null)

    await this.titleReadPromise
    if (this.file !== file) {
      this.submitting.set(false)
      return
    }

    const title = this.title().trim() || this.getFilenameTitle(file.name)
    let cover: File | null = null
    try {
      cover = await this.coverGenerator.generateAutomaticCover(title)
    } catch {
      // Automatic cover generation is optional; the HTML file remains submitable.
    }

    if (this.file !== file) {
      this.submitting.set(false)
      return
    }

    this.gamesService.create(file, {
      title,
      description: '',
      instructions: '',
      category: 'other',
      tags: '',
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
    this.titleReadPromise = this.readHtmlTitle(file, generation)
  }

  private async readHtmlTitle (file: File, generation: number) {
    try {
      const source = await file.text()
      if (generation !== this.fileGeneration || this.file !== file) return

      const title = this.extractHtmlTitle(source)
      if (title) this.title.set(title)
    } catch {
      // The filename fallback is already available and is sufficient to submit.
    }
  }

  private extractHtmlTitle (source: string) {
    let rawTitle: string
    try {
      rawTitle = new DOMParser().parseFromString(source, 'text/html').querySelector('title')?.textContent || ''
    } catch {
      rawTitle = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''
    }

    return this.normalizeTitle(rawTitle)
  }

  private getFilenameTitle (filename: string) {
    const title = filename.replace(/\.[^.]+$/, '').replace(/[_.-]+/g, ' ').trim()
    return this.normalizeTitle(title || '未命名游戏') || '未命名游戏'
  }

  private resetForNewFile () {
    this.fileGeneration += 1
    this.file = null
    this.titleReadPromise = null
    this.title.set('')
    this.fileSize.set(0)
    this.dragActive.set(false)
    this.error.set('')
    this.message.set('')
    this.createdGame.set(null)
    this.resetCoverState()
  }

  private hasUnsavedChanges () {
    return !!this.file && !this.submitting() && !this.createdGame()
  }

  private resetCoverState () {
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
