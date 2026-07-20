import { ChangeDetectionStrategy, Component, computed, HostListener, inject, OnInit, signal } from '@angular/core'
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { getGameActionErrorMessage } from './game-action-feedback'
import { isSupportedGameRuntimeFilename } from './games-api'
import { GamesService } from './games.service'

@Component({
  templateUrl: './game-edit.component.html',
  styleUrl: './game-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ FormsModule, RouterLink ]
})
export class GameEditComponent implements OnInit {
  private readonly gamesService = inject(GamesService)
  private readonly route = inject(ActivatedRoute)
  private readonly sanitizer = inject(DomSanitizer)
  readonly loading = signal(true)
  readonly submitting = signal(false)
  readonly message = signal('')
  readonly error = signal('')
  readonly fileError = signal('')
  readonly runtimePreview = signal<SafeResourceUrl | null>(null)
  readonly uuid = this.route.snapshot.paramMap.get('uuid') || ''
  file: File | null = null
  cover: File | null = null
  title = ''
  description = ''
  instructions = ''
  category = ''
  tags = ''

  tagCount = computed(() => this.tags.split(',').filter(t => t.trim()).length)
  isValid = computed(() => this.title.trim().length > 0 && this.category.trim().length > 0)
  submittingMessage = computed(() => {
    if (this.submitting()) return '正在保存...'
    if (!this.title.trim()) return '请输入标题'
    if (!this.category.trim()) return '请选择分类'
    return '保存修改'
  })

  ngOnInit () {
    this.gamesService.get(this.uuid).subscribe({
      next: game => {
        this.title = game.title
        this.description = game.description
        this.instructions = game.instructions
        this.category = game.category
        this.tags = game.tags.join(', ')
        this.runtimePreview.set(this.sanitizer.bypassSecurityTrustResourceUrl(game.runtimeUrl))
        this.loading.set(false)
      },
      error: () => { this.error.set('无法加载游戏，可能没有管理权限。'); this.loading.set(false) }
    })
  }

  onFileChange (event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0] || null
    if (file && !isSupportedGameRuntimeFilename(file.name)) {
      this.file = null
      this.fileError.set('只支持 .html 或 .htm 文件')
      return
    }
    if (file && file.size > 20 * 1024 * 1024) {
      this.file = null
      this.fileError.set('文件不能超过 20MB')
      return
    }

    this.fileError.set('')
    this.error.set('')
    this.file = file

    // Preview new file
    if (file) {
      const url = URL.createObjectURL(file)
      this.runtimePreview.set(this.sanitizer.bypassSecurityTrustResourceUrl(url))
    }
  }

  onCoverChange (event: Event) { this.cover = (event.target as HTMLInputElement).files?.[0] || null }

  submit () {
    if (!this.isValid()) {
      this.error.set('请填写游戏标题并选择分类。')
      return
    }
    this.submitting.set(true)
    this.error.set('')
    this.gamesService.update(this.uuid, {
      title: this.title.trim(), description: this.description.trim(), instructions: this.instructions.trim(),
      category: this.category.trim(), tags: this.tags, file: this.file, cover: this.cover
    }).subscribe({
      next: game => { this.submitting.set(false); this.message.set(game.status === 'pending' ? '修改已提交，等待重新审核。' : '修改已保存。') },
      error: error => { this.submitting.set(false); this.error.set(getGameActionErrorMessage(error)) }
    })
  }

  formatFileSize (bytes: number) {
    return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  private hasUnsavedChanges (): boolean {
    return !this.submitting() && !this.message() && (
      this.title.trim().length > 0 ||
      this.description.trim().length > 0 ||
      this.tags.trim().length > 0 ||
      !!this.file ||
      !!this.cover
    )
  }

  @HostListener('window:beforeunload', [ '$event' ])
  onBeforeUnload (event: BeforeUnloadEvent) {
    if (this.hasUnsavedChanges()) {
      event.preventDefault()
      event.returnValue = '你有未保存的修改，确定离开吗？'
      return event.returnValue
    }
    return undefined
  }
}
