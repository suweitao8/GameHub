import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { FormsModule } from '@angular/forms'
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
  readonly loading = signal(true)
  readonly submitting = signal(false)
  readonly message = signal('')
  readonly error = signal('')
  readonly uuid = this.route.snapshot.paramMap.get('uuid') || ''
  file: File | null = null
  cover: File | null = null
  title = ''
  description = ''
  instructions = ''
  category = ''
  tags = ''

  ngOnInit () {
    this.gamesService.get(this.uuid).subscribe({
      next: game => {
        this.title = game.title
        this.description = game.description
        this.instructions = game.instructions
        this.category = game.category
        this.tags = game.tags.join(', ')
        this.loading.set(false)
      },
      error: () => { this.error.set('无法加载游戏，可能没有管理权限。'); this.loading.set(false) }
    })
  }

  onFileChange (event: Event) { this.file = (event.target as HTMLInputElement).files?.[0] || null }
  onCoverChange (event: Event) { this.cover = (event.target as HTMLInputElement).files?.[0] || null }

  submit () {
    this.submitting.set(true)
    this.error.set('')
    this.gamesService.update(this.uuid, {
      title: this.title.trim(), description: this.description.trim(), instructions: this.instructions.trim(),
      category: this.category.trim(), tags: this.tags, file: this.file, cover: this.cover
    }).subscribe({
      next: game => { this.submitting.set(false); this.message.set(game.status === 'pending' ? '修改已提交，等待重新审核。' : '修改已保存。') },
      error: () => { this.submitting.set(false); this.error.set('保存失败，请检查内容和文件格式。') }
    })
  }
}
