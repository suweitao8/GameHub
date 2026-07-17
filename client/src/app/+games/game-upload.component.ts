import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core'
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { GamesService } from './games.service'

@Component({
  templateUrl: './game-upload.component.html',
  styleUrl: './game-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ FormsModule, RouterLink ]
})
export class GameUploadComponent implements OnDestroy {
  private readonly gamesService = inject(GamesService)
  private readonly sanitizer = inject(DomSanitizer)
  private previewObjectUrl = ''
  private previewTimer: ReturnType<typeof setTimeout> | undefined
  private previewToken = ''
  private previewHandled = false
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
  readonly previewUrl = signal<SafeResourceUrl | null>(null)
  readonly previewStatus = signal('')
  readonly previewError = signal('')
  readonly coverSource = signal<'runtime' | 'generated' | 'manual'>('generated')
  private readonly runtimeScreenshot = signal('')

  constructor () {
    window.addEventListener('message', this.onPreviewMessage)
  }

  ngOnDestroy () {
    window.removeEventListener('message', this.onPreviewMessage)
    if (this.previewTimer) clearTimeout(this.previewTimer)
    if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl)
  }

  onFileChange (event: Event) {
    this.file = (event.target as HTMLInputElement).files?.[0] || null
    this.fileSize.set(this.file?.size || 0)
    if (this.file && this.file.size > 20 * 1024 * 1024) {
      this.error.set('单文件 HTML 最大 20MB，请压缩后再试。')
      this.file = null
      return
    }

    this.error.set('')
    this.cover = null
    this.coverPreview.set('')
    this.coverSource.set('generated')
    this.previewError.set('')
    if (this.file) void this.preparePreview(this.file)
  }

  onCoverChange (event: Event) {
    this.cover = (event.target as HTMLInputElement).files?.[0] || null
    this.coverSource.set('manual')
    this.setCoverPreview(this.cover)
  }

  async submit () {
    if (!this.file || !this.title.trim()) {
      this.error.set('请选择单文件 HTML 游戏并填写标题。')
      return
    }
    this.submitting.set(true)
    this.step.set(2)
    this.previewStatus.set('正在上传并检查文件…')
    this.error.set('')
    this.message.set('')
    let cover = this.cover
    if (!cover) {
      this.step.set(4)
      this.previewStatus.set('正在生成封面…')
      cover = await this.generateAutomaticCover()
      this.cover = cover
      this.coverSource.set('generated')
      this.setCoverPreview(cover)
    }
    this.step.set(5)
    this.previewStatus.set('正在提交审核…')
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
        this.previewStatus.set('上传成功')
        this.message.set(game.status === 'published' ? '上传成功，游戏已发布。' : '上传成功，等待管理员审核。')
      },
      error: () => {
        this.submitting.set(false)
        this.step.set(1)
        this.previewStatus.set('')
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
    this.previewStatus.set('正在生成封面…')
    this.cover = this.runtimeScreenshot() ? await this.coverFromScreenshot(this.runtimeScreenshot()) : await this.generateAutomaticCover()
    this.coverSource.set(this.runtimeScreenshot() ? 'runtime' : 'generated')
    this.setCoverPreview(this.cover)
    this.step.set(5)
    this.previewStatus.set('封面已生成')
  }

  onPreviewLoaded () {
    this.step.set(3)
    this.previewStatus.set('正在检测运行错误…')
    if (this.previewTimer) clearTimeout(this.previewTimer)
    this.previewTimer = setTimeout(() => {
      if (!this.previewHandled && !this.previewError()) void this.finishPreview()
    }, 1800)
  }

  private readonly onPreviewMessage = (event: MessageEvent) => {
    const data = event.data
    if (data?.source !== 'gamehub-upload-preview' || data.token !== this.previewToken || this.previewHandled) return
    if (data.kind === 'error') {
      this.previewError.set(data.message || '游戏运行检测失败')
      this.error.set('系统检测到游戏运行错误，请修复 HTML 后重新选择文件。')
      this.previewStatus.set('运行检测失败')
      return
    }

    this.previewHandled = true
    if (this.previewTimer) clearTimeout(this.previewTimer)
    if (data.kind === 'canvas' && typeof data.dataUrl === 'string') {
      this.runtimeScreenshot.set(data.dataUrl)
      void this.finishPreview(data.dataUrl)
    } else {
      void this.finishPreview()
    }
  }

  private async preparePreview (file: File) {
    this.step.set(2)
    this.previewStatus.set('正在检查文件…')
    const source = await file.text()
    if (!/<(?:!doctype\s+html|html|body)\b/i.test(source)) {
      this.error.set('文件不是可识别的 HTML 文档，请选择单文件 HTML。')
      this.previewStatus.set('文件检查失败')
      return
    }

    if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl)
    this.previewToken = crypto.randomUUID()
    this.previewHandled = false
    this.runtimeScreenshot.set('')
    const wrapped = this.wrapPreviewDocument(source, this.previewToken)
    this.previewObjectUrl = URL.createObjectURL(new Blob([ wrapped ], { type: 'text/html' }))
    this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl))
    this.step.set(3)
    this.previewStatus.set('正在启动游戏…')
  }

  private async finishPreview (dataUrl?: string) {
    this.step.set(4)
    this.previewStatus.set('正在生成封面…')
    this.cover = dataUrl ? await this.coverFromScreenshot(dataUrl) : await this.generateAutomaticCover()
    this.coverSource.set(dataUrl ? 'runtime' : 'generated')
    this.setCoverPreview(this.cover)
    this.step.set(5)
    this.previewStatus.set(dataUrl ? '已生成运行截图封面' : '已生成 GameHub 封面')
  }

  private coverFromScreenshot (dataUrl: string): Promise<File | null> {
    return new Promise(resolve => {
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 1280
        canvas.height = 720
        const context = canvas.getContext('2d')
        if (!context) return resolve(null)
        context.fillStyle = '#111827'
        context.fillRect(0, 0, canvas.width, canvas.height)
        const scale = Math.min(canvas.width / image.width, canvas.height / image.height)
        const width = image.width * scale
        const height = image.height * scale
        context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
        canvas.toBlob(blob => {
          const file = blob ? new File([ blob ], 'gamehub-runtime-screenshot.png', { type: 'image/png' }) : null
          resolve(file)
        }, 'image/png')
      }
      image.onerror = () => resolve(null)
      image.src = dataUrl
    })
  }

  private wrapPreviewDocument (source: string, token: string) {
    const probe = `<script>
      (() => {
        const send = payload => parent.postMessage({ source: 'gamehub-upload-preview', token: ${JSON.stringify(token)}, ...payload }, '*')
        window.addEventListener('error', event => send({ kind: 'error', message: event.message }))
        const inspect = () => {
          const canvas = document.querySelector('canvas')
          if (canvas && canvas.width && canvas.height) send({ kind: 'canvas', dataUrl: canvas.toDataURL('image/png') })
          else send({ kind: 'ready' })
        }
        window.addEventListener('load', () => setTimeout(inspect, 500))
        setTimeout(inspect, 1500)
      })()
    </script>`
    return source.includes('</body>') ? source.replace('</body>', `${probe}</body>`) : `${source}${probe}`
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
