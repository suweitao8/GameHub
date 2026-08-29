import { booleanAttribute, Component, input, OnChanges, OnInit, ChangeDetectionStrategy } from '@angular/core'
import { GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap'
import { ENHANCED_RULES, TEXT_RULES } from '@peertube/peertube-core-utils'
import { GlobalIconComponent } from '../../shared-icons/global-icon.component'

@Component({
  selector: 'my-help',
  styleUrls: [ './help.component.scss' ],
  templateUrl: './help.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ NgbPopover, GlobalIconComponent ]
})
export class HelpComponent implements OnInit, OnChanges {
  readonly helpTitle = input('')
  readonly helpType = input<'custom' | 'markdownText' | 'markdownEnhanced'>('custom')
  readonly iconName = input<GlobalIconName>('help')
  readonly supportRelMe = input(false, { transform: booleanAttribute })

  readonly title = input($localize`获取帮助`)

  readonly tooltipPlacement = input('right auto')
  readonly autoClose = input('outside')
  readonly container = input<'body'>(undefined)

  isPopoverOpened = false
  markdownHTML = ''

  ngOnInit () {
    this.init()
  }

  ngOnChanges () {
    this.init()
  }

  onPopoverHidden () {
    this.isPopoverOpened = false
  }

  onPopoverShown () {
    this.isPopoverOpened = true
  }

  private init () {
    const helpType = this.helpType()
    if (helpType === 'markdownText') {
      this.markdownHTML = this.formatMarkdownSupport(TEXT_RULES)
      return
    }

    if (helpType === 'markdownEnhanced') {
      this.markdownHTML = this.formatMarkdownSupport(ENHANCED_RULES)
      return
    }
  }

  private formatMarkdownSupport (rules: string[]) {
    let str =
      $localize`支持以下 Markdown 格式：` +
      this.createMarkdownList(rules)

    if (this.supportRelMe()) {
      str +=
      $localize`也支持 Mastodon 验证链接。`
    }

    return str
  }

  private createMarkdownList (rules: string[]) {
    const rulesToText: { [id: string]: string } = {
      emphasis: $localize`强调`,
      link: $localize`链接`,
      newline: $localize`换行`,
      list: $localize`列表`,
      image: $localize`图片`
    }

    const bullets = rules.map(r => rulesToText[r])
      .filter(text => text)
      .map(text => '<li>' + text + '</li>')
      .join('')

    return '<ul>' + bullets + '</ul>'
  }
}
