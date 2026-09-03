import { Injectable, signal } from '@angular/core'
import { buildGameCoverDataUrl, getGameCoverPresetUrl } from '../../shared/game-cover'

const COVER_WIDTH = 512
const COVER_HEIGHT = 288
const COVER_JPEG_QUALITY = 0.78

/**
 * Generates GameHub game covers from a category preset (with an SVG fallback) or from a
 * runtime screenshot captured by GamePreviewProbeService. Keeps the produced
 * File plus a dataURL preview and the cover source origin ('runtime' |
 * 'generated' | 'manual') as signals the upload form subscribes to.
 */
@Injectable({ providedIn: 'root' })
export class CoverGeneratorService {
  readonly coverPreview = signal('')
  readonly coverSource = signal<'runtime' | 'generated' | 'manual'>('generated')

  /** Build a 512×288 compressed JPEG from the category preset and game title. */
  async generateAutomaticCover (title: string, category = 'other'): Promise<File | null> {
    const image = await this.loadImage(getGameCoverPresetUrl(category))
      .catch((): Promise<HTMLImageElement> => this.loadImage(buildGameCoverDataUrl(title, category)))
      .catch((): null => null)

    return image ? this.renderCover(image, title, 'gamehub-auto-cover.jpg') : null
  }

  /** Composite a runtime screenshot into the same 512×288 JPEG cover contract. */
  async coverFromScreenshot (dataUrl: string, title: string): Promise<File | null> {
    const image = await this.loadImage(dataUrl).catch((): null => null)
    return image ? this.renderCover(image, title, 'gamehub-runtime-screenshot.jpg') : null
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
   * automatic light-skin cover. Sets the source signal and preview accordingly.
   */
  async regenerateCover (title: string, runtimeScreenshot: string, category = 'other'): Promise<File | null> {
    const file = runtimeScreenshot
      ? await this.coverFromScreenshot(runtimeScreenshot, title)
      : await this.generateAutomaticCover(title, category)
    this.coverSource.set(runtimeScreenshot ? 'runtime' : 'generated')
    this.setCoverPreview(file)
    return file
  }

  private loadImage (source: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      if (!source) {
        reject(new Error('封面图片地址为空'))
        return
      }

      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('封面图片加载失败'))
      image.src = source
    })
  }

  private renderCover (image: HTMLImageElement, title: string, filename: string): Promise<File | null> {
    const canvas = document.createElement('canvas')
    canvas.width = COVER_WIDTH
    canvas.height = COVER_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) return Promise.resolve(null)

    const sourceWidth = image.naturalWidth || image.width
    const sourceHeight = image.naturalHeight || image.height
    if (!sourceWidth || !sourceHeight) return Promise.resolve(null)

    context.fillStyle = '#eef2f5'
    context.fillRect(0, 0, canvas.width, canvas.height)
    const scale = Math.max(canvas.width / sourceWidth, canvas.height / sourceHeight)
    const width = sourceWidth * scale
    const height = sourceHeight * scale
    context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
    this.drawTitlePanel(context, title)

    return new Promise(resolve => {
      canvas.toBlob(blob => {
        resolve(blob ? new File([ blob ], filename, { type: 'image/jpeg' }) : null)
      }, 'image/jpeg', COVER_JPEG_QUALITY)
    })
  }

  private drawTitlePanel (context: CanvasRenderingContext2D, title: string) {
    const normalizedTitle = title.trim() || 'GameHub 游戏'
    const maxTextWidth = COVER_WIDTH - 48
    const font = '700 28px Arial, Microsoft YaHei, sans-serif'
    context.font = font

    const lines: string[] = []
    let currentLine = ''
    for (const character of Array.from(normalizedTitle)) {
      const candidate = currentLine + character
      if (currentLine && context.measureText(candidate).width > maxTextWidth) {
        lines.push(currentLine)
        currentLine = character
      } else {
        currentLine = candidate
      }
    }
    if (currentLine) lines.push(currentLine)

    if (lines.length > 2) {
      lines.length = 2
      let lastLine = lines[1]
      while (lastLine && context.measureText(lastLine + '…').width > maxTextWidth) {
        lastLine = lastLine.slice(0, -1)
      }
      lines[1] = lastLine + '…'
    }

    const lineHeight = 34
    const panelHeight = lines.length * lineHeight + 32
    const panelTop = COVER_HEIGHT - panelHeight
    context.fillStyle = 'rgba(255, 255, 255, .86)'
    context.fillRect(0, panelTop, COVER_WIDTH, panelHeight)
    context.fillStyle = 'rgba(24, 47, 58, .14)'
    context.fillRect(0, panelTop, COVER_WIDTH, 2)
    context.fillStyle = '#182f3a'
    context.font = font
    lines.forEach((line, index) => context.fillText(line, 24, panelTop + 25 + index * lineHeight))
  }
}
