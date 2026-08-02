import { Pipe, PipeTransform } from '@angular/core'

/**
 * 高亮文本中的关键词
 * Usage: <span [innerHTML]="text | highlight: searchTerm"></span>
 */
@Pipe({ name: 'highlight', standalone: true })
export class HighlightPipe implements PipeTransform {
  transform (value: string | undefined | null, searchTerm: string | undefined): string {
    if (!value || !searchTerm) return value || ''
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, 'gi')
    return value.replace(regex, '<mark class="search-highlight">$1</mark>')
  }
}
