import { inject, Injectable, OnDestroy, signal } from '@angular/core'
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser'

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

  readonly previewUrl = signal<SafeResourceUrl | null>(null)
  readonly previewStatus = signal('')
  readonly previewError = signal('')
  readonly error = signal('')
  readonly step = signal(1)
  /** Captured runtime screenshot data URL (canvas capture path only). */
  readonly runtimeScreenshot = signal('')

  private objectUrl = ''
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
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    this.objectUrl = ''
    this.previewUrl.set(null)
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

    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    this.token = crypto.randomUUID()
    this.handled = false
    this.runtimeScreenshot.set('')
    const wrapped = this.wrapDocument(source, this.token)
    this.objectUrl = URL.createObjectURL(new Blob([ wrapped ], { type: 'text/html' }))
    this.previewReady = true
    this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl))
    this.step.set(3)
    this.previewStatus.set('正在启动游戏…')
  }

  /** Called when the preview iframe finishes loading — arms the capture timeout. */
  onPreviewLoaded (event: Event) {
    if (!this.previewReady) return

    const iframe = event.target as HTMLIFrameElement | null
    if (iframe && this.objectUrl && iframe.src !== this.objectUrl) return

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
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    this.objectUrl = ''
    this.previewUrl.set(null)
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
            captured = true
            send({ kind: 'canvas', dataUrl: canvas.toDataURL('image/png') })
            return true
          } catch {
            return false
          }
        }
        const captureDom = () => {
          if (captured) return
          const width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0, 640)
          const height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0, 360)
          const styles = Array.from(document.querySelectorAll('style')).map(style => style.textContent || '').join('\\n')
          const bodyElement = document.body?.cloneNode(true)
          bodyElement?.querySelectorAll('script, iframe').forEach(element => element.remove())
          const body = bodyElement?.innerHTML || document.documentElement.innerHTML
          const svgOpen = [
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="',
            width,
            '" height="',
            height,
            '"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:',
            width,
            'px;height:',
            height,
            'px;overflow:hidden;background:#f6f7f8;">'
          ].join('')
          const svg = svgOpen + '<style>' + styles.replace(/<\\/style>/gi, '') + '</style>' + body + '</div></foreignObject></svg>'
          const image = new Image()
          image.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = 1280
            canvas.height = 720
            const context = canvas.getContext('2d')
            if (!context) return
            context.drawImage(image, 0, 0, canvas.width, canvas.height)
            sendCanvas(canvas)
          }
          image.onerror = () => undefined
          image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
        }
        const inspect = () => {
          if (sendCanvas(document.querySelector('canvas'))) return
          captureDom()
          if (!captured) send({ kind: 'ready' })
        }
        window.addEventListener('load', () => setTimeout(inspect, 700))
        setTimeout(inspect, 1800)
      })()
    </script>`
    return source.includes('</body>') ? source.replace('</body>', `${probe}</body>`) : `${source}${probe}`
  }
}
