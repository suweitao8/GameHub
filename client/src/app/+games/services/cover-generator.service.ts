import { Injectable, signal } from '@angular/core'

/**
 * Generates GameHub game covers from a title (gradient + label) or from a
 * runtime screenshot captured by GamePreviewProbeService. Keeps the produced
 * File plus a dataURL preview and the cover source origin ('runtime' |
 * 'generated' | 'manual') as signals the upload form subscribes to.
 */
@Injectable({ providedIn: 'root' })
export class CoverGeneratorService {
  readonly coverPreview = signal('')
  readonly coverSource = signal<'runtime' | 'generated' | 'manual'>('generated')

  /** Build an automatic gradient + title cover File (1280x720 png). */
  async generateAutomaticCover (title: string): Promise<File | null> {
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720
    const context = canvas.getContext('2d')
    if (!context) return null

    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#5044e4')
    gradient.addColorStop(1, '#7c3aed')
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = 'rgba(255, 255, 255, .16)'
    for (let index = 0; index < 7; index++) context.fillRect(index * 220 - 100, 0, 80, canvas.height)
    context.fillStyle = '#fff'
    context.font = '800 72px Arial'
    context.fillText(title.trim() || 'GameHub 游戏', 72, 400)
    context.font = '600 28px Arial'
    context.fillText('GameHub 网页小游戏', 76, 465)

    return new Promise(resolve => canvas.toBlob(blob => {
      resolve(blob ? new File([ blob ], 'gamehub-auto-cover.png', { type: 'image/png' }) : null)
    }, 'image/png'))
  }

  /** Composite a runtime screenshot with a dark title overlay (1280x720 png). */
  coverFromScreenshot (dataUrl: string, title: string): Promise<File | null> {
    return new Promise(resolve => {
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 1280
        canvas.height = 720
        const context = canvas.getContext('2d')
        if (!context) return resolve(null)
        context.fillStyle = '#eef2f5'
        context.fillRect(0, 0, canvas.width, canvas.height)
        const scale = Math.max(canvas.width / image.width, canvas.height / image.height)
        const width = image.width * scale
        const height = image.height * scale
        context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
        const overlay = context.createLinearGradient(0, canvas.height * 0.58, 0, canvas.height)
        overlay.addColorStop(0, 'rgba(12, 20, 30, 0)')
        overlay.addColorStop(1, 'rgba(12, 20, 30, .82)')
        context.fillStyle = overlay
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = '#fff'
        context.font = '700 38px Arial, Microsoft YaHei, sans-serif'
        context.shadowColor = 'rgba(0, 0, 0, .25)'
        context.shadowBlur = 5
        context.fillText(title.trim() || 'GameHub 游戏', 48, 625)
        context.shadowBlur = 0
        context.font = '600 20px Arial, Microsoft YaHei, sans-serif'
        context.fillStyle = 'rgba(255, 255, 255, .86)'
        context.fillText('GameHub 网页小游戏', 50, 662)
        canvas.toBlob(blob => {
          const file = blob ? new File([ blob ], 'gamehub-runtime-screenshot.png', { type: 'image/png' }) : null
          resolve(file)
        }, 'image/png')
      }
      image.onerror = () => resolve(null)
      image.src = dataUrl
    })
  }

  /** Read a manually chosen cover File into a dataURL preview. */
  setCoverPreview (file: File | null) {
    if (!file) {
      this.coverPreview.set('')
      return
    }

    const reader = new FileReader()
    reader.onload = () => this.coverPreview.set(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  /**
   * Regenerate the cover: prefer the supplied runtime screenshot, otherwise an
   * automatic gradient cover. Sets the source signal and preview accordingly.
   */
  async regenerateCover (title: string, runtimeScreenshot: string): Promise<File | null> {
    const file = runtimeScreenshot
      ? await this.coverFromScreenshot(runtimeScreenshot, title)
      : await this.generateAutomaticCover(title)
    this.coverSource.set(runtimeScreenshot ? 'runtime' : 'generated')
    this.setCoverPreview(file)
    return file
  }
}
