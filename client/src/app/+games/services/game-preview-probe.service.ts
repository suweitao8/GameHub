import { inject, Injectable, OnDestroy, signal } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'

type PreviewCompleteCallback = (runtimeScreenshot?: string) => void

/**
 * Drives the HTML game upload preview iframe: wraps the uploaded document
 * with a probe script, listens for capture/error messages, and exposes the
 * preview lifecycle state (url, status, errors, runtime screenshot) plus the
 * shared upload `step` indicator that the preview phases advance.
 *
 * Cover generation is intentionally left to CoverGeneratorService; this service
 * only reports when detection completed (with an optional runtime screenshot)
 * via the `onComplete` callback passed to `prepare()`.
 */
@Injectable({ providedIn: 'root' })
export class GamePreviewProbeService implements OnDestroy {
  private readonly sanitizer = inject(DomSanitizer)

  readonly previewSource = signal<SafeHtml | null>(null)
  readonly previewStatus = signal('')
  readonly previewError = signal('')
  readonly error = signal('')
  readonly step = signal(1)
  /** Captured runtime screenshot data URL (canvas capture path only). */
  readonly runtimeScreenshot = signal('')

  private timer: ReturnType<typeof setTimeout> | undefined
  private token = ''
  private prepareGeneration = 0
  private previewReady = false
  private handled = false
  private onComplete: PreviewCompleteCallback | undefined

  constructor () {
    window.addEventListener('message', this.onMessage)
  }

  /** Begin previewing `file`: validate, wrap with the probe, build the iframe URL. */
  async prepare (file: File, onComplete: PreviewCompleteCallback) {
    const generation = ++this.prepareGeneration
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    this.previewSource.set(null)
    this.previewReady = false
    this.previewError.set('')
    this.runtimeScreenshot.set('')
    this.handled = false
    this.onComplete = onComplete
    this.step.set(2)
    this.previewStatus.set('正在检查文件…')
    const source = await file.text()
    if (generation !== this.prepareGeneration) return
    if (!/<(?:!doctype\s+html|html|body)\b/i.test(source)) {
      this.error.set('文件不是可识别的 HTML 文档，请选择单文件 HTML。')
      this.previewStatus.set('文件检查失败')
      return
    }

    this.token = crypto.randomUUID()
    this.handled = false
    this.runtimeScreenshot.set('')
    const wrapped = this.wrapDocument(source, this.token)
    this.previewReady = true
    this.previewSource.set(this.sanitizer.bypassSecurityTrustHtml(wrapped))
    this.step.set(3)
    this.previewStatus.set('正在启动游戏…')
  }

  /** Called when the preview iframe finishes loading — arms the capture timeout. */
  onPreviewLoaded (event: Event) {
    if (!this.previewReady) return
    if (!(event.target instanceof HTMLIFrameElement)) return

    this.step.set(3)
    this.previewStatus.set('正在检测运行错误…')
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      if (!this.handled && !this.previewError()) this.complete()
    }, 2800)
  }

  reset () {
    this.prepareGeneration += 1
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    this.previewSource.set(null)
    this.previewReady = false
    this.previewStatus.set('')
    this.error.set('')
    this.handled = false
    this.runtimeScreenshot.set('')
    this.previewError.set('')
    this.onComplete = undefined
    this.step.set(1)
  }

  ngOnDestroy () {
    window.removeEventListener('message', this.onMessage)
    this.reset()
  }

  private complete (runtimeScreenshot?: string) {
    this.handled = true
    if (this.timer) clearTimeout(this.timer)
    this.runtimeScreenshot.set(runtimeScreenshot || '')
    this.onComplete?.(runtimeScreenshot)
  }

  private readonly onMessage = (event: MessageEvent) => {
    const data = event.data
    if (data?.source !== 'gamehub-upload-preview' || data.token !== this.token || this.handled) return
    if (data.kind === 'error') {
      this.previewError.set(data.message || '游戏运行检测失败')
      this.error.set('系统检测到游戏运行错误，请修复 HTML 后重新选择文件。')
      this.previewStatus.set('运行检测失败')
      return
    }

    // The probe can report that capture has started before the asynchronous
    // DOM snapshot is ready. Keep waiting so the real runtime screenshot wins
    // over the generated fallback cover.
    if (data.kind === 'ready') return

    if (data.kind === 'canvas' && typeof data.dataUrl === 'string') {
      this.complete(data.dataUrl)
    } else {
      this.complete()
    }
  }

  private wrapDocument (source: string, token: string) {
    const probe = `<script>
      (() => {
        const send = payload => parent.postMessage({ source: 'gamehub-upload-preview', token: ${JSON.stringify(token)}, ...payload }, '*')
        let captured = false
        window.addEventListener('error', event => send({ kind: 'error', message: event.message }))
        const sendCanvas = canvas => {
          if (captured || !canvas || !canvas.width || !canvas.height) return false
          try {
            const dataUrl = canvas.toDataURL('image/png')
            captured = true
            send({ kind: 'canvas', dataUrl })
            return true
          } catch {
            return false
          }
        }
        const renderDomToCanvas = () => {
          if (captured) return true
          const width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0, 640)
          const height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0, 360)
          const canvas = document.createElement('canvas')
          canvas.width = 1280
          canvas.height = 720
          const context = canvas.getContext('2d')
          const body = document.body
          if (!context || !body) return false
          const scaleX = canvas.width / width
          const scaleY = canvas.height / height
          const getColor = value => value && value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)' ? value : ''
          const visible = element => {
            const rect = element.getBoundingClientRect()
            const style = getComputedStyle(element)
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' &&
              style.visibility !== 'hidden' && Number(style.opacity || 1) > 0
          }
          const elements = Array.from(document.querySelectorAll('body *')).filter(visible).slice(0, 100)
          context.save()
          context.scale(scaleX, scaleY)
          context.fillStyle = getColor(getComputedStyle(body).backgroundColor) || '#f6f7f8'
          context.fillRect(0, 0, width, height)
          elements.forEach(element => {
            const style = getComputedStyle(element)
            const rect = element.getBoundingClientRect()
            const background = getColor(style.backgroundColor)
            if (background) {
              context.fillStyle = background
              context.beginPath()
              if (typeof context.roundRect === 'function') {
                context.roundRect(rect.x, rect.y, rect.width, rect.height, parseFloat(style.borderRadius) || 0)
              }
              else context.rect(rect.x, rect.y, rect.width, rect.height)
              context.fill()
            }
            if (style.borderStyle !== 'none' && parseFloat(style.borderTopWidth) > 0) {
              context.strokeStyle = getColor(style.borderTopColor) || '#d9dce1'
              context.lineWidth = parseFloat(style.borderTopWidth)
              context.strokeRect(rect.x, rect.y, rect.width, rect.height)
            }
          })
          elements.filter(element => element.children.length === 0 || /^(H1|H2|H3|BUTTON|LABEL)$/.test(element.tagName))
            .forEach(element => {
            const text = (element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 180)
            if (!text) return
            const style = getComputedStyle(element)
            const rect = element.getBoundingClientRect()
            const fontSize = Math.max(12, parseFloat(style.fontSize) || 16)
            const lineHeight = Math.max(fontSize * 1.25, parseFloat(style.lineHeight) || fontSize * 1.25)
            const maxWidth = Math.max(40, rect.width - 8)
            context.fillStyle = getColor(style.color) || '#30343b'
            context.font = (style.fontWeight || '400') + ' ' + fontSize + 'px ' + (style.fontFamily || 'Arial')
            context.textBaseline = 'top'
            let line = ''
            let lineY = rect.y
            let lineCount = 0
            for (const character of Array.from(text)) {
              const next = line + character
              if (line && context.measureText(next).width > maxWidth) {
                context.fillText(line, rect.x, lineY)
                line = character
                lineY += lineHeight
                lineCount += 1
                if (lineCount >= 4) break
              } else {
                line = next
              }
            }
            if (line && lineCount < 4) context.fillText(line, rect.x, lineY)
          })
          context.restore()
          return sendCanvas(canvas)
        }
        const captureDom = () => {
          if (captured) return true
          return renderDomToCanvas()
        }
        const inspect = () => {
          if (sendCanvas(document.querySelector('canvas'))) return
          if (!captureDom()) send({ kind: 'ready' })
        }
        window.addEventListener('load', () => setTimeout(inspect, 700))
        setTimeout(inspect, 1800)
      })()
    </script>`
    return /<\/body>/i.test(source) ? source.replace(/<\/body>/i, `${probe}</body>`) : `${source}${probe}`
  }
}
