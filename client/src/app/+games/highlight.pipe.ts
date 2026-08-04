import { Pipe, PipeTransform } from '@angular/core'

/**
 * 高亮文本中的关键词
 * Usage: <span [innerHTML]="text | highlight: searchTerm"></span>
 *
 * 先对原始文本做 HTML 转义（防止 XSS），再在高亮关键词上加 <mark> 标签。
 */
@Pipe({ name: 'highlight', standalone: true })
export class HighlightPipe implements PipeTransform {
  transform (value: string | undefined | null, searchTerm: string | undefined): string {
    if (!value) return ''
    // 先 HTML 转义，防止标题中的 HTML 标签被 innerHTML 解析
    const safe = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
    if (!searchTerm) return safe
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, 'gi')
    return safe.replace(regex, '<mark class="search-highlight">$1</mark>')
  }
}
