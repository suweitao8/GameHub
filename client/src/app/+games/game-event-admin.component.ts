import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core'
import { RouterLink } from '@angular/router'
import { HttpClient } from '@angular/common/http'
import { map } from 'rxjs/operators'
import { environment } from '../../environments/environment'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'
import { createAsyncState } from './shared'

export type GameEventAdmin = {
  id: number
  title: string
  description: string | null
  slug: string
  type: 'activity' | 'competition'
  status: 'upcoming' | 'ongoing' | 'ended' | 'cancelled'
  coverPath: string | null
  startAt: string | null
  endAt: string | null
  rules: string | null
  prizes: string | null
  maxParticipants: number
  participantCount: number
  createdAt: string
}

@Component({
  selector: 'my-game-event-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ RouterLink, GlobalIconComponent ],
  template: `
    <div class="event-admin-container">
      <div class="event-admin-header">
        <h2>活动管理</h2>
        <p>创建和管理社区活动与比赛</p>
      </div>

      @if (loading()) {
        <div class="event-admin-skeleton">
          @for (_ of [ 1, 2, 3 ]; track $index) {
            <div class="admin-skeleton-row shimmer"></div>
          }
        </div>
      } @else if (eventsState.hasError()) {
        <div class="event-admin-state" role="alert">
          <h3>活动列表加载失败</h3>
          <p>{{ eventsState.error() || '请稍后重试。' }}</p>
          <button type="button" (click)="loadEvents()">重新加载</button>
        </div>
      } @else {
        <div class="event-admin-actions">
          <button type="button" class="create-event-btn" (click)="startCreate()">
            <my-global-icon iconName="plus" /> 创建活动
          </button>
        </div>
        @if (formFeedback() && !showForm()) { <p class="admin-feedback" role="alert">{{ formFeedback() }}</p> }

        @if (showForm()) {
          <form class="event-form" (submit)="$event.preventDefault(); submitForm()">
            <div class="form-row">
              <label>
                标题
                <input [value]="formTitle()" (input)="formTitle.set($any($event.target).value)" required>
              </label>
              <label>
                Slug
                <input [value]="formSlug()" (input)="formSlug.set($any($event.target).value)"
                       [readonly]="editingSlug() !== null" required>
              </label>
            </div>
            <div class="form-row">
              <label>类型
                <select [value]="formType()" (change)="formType.set($any($event.target).value)">
                  <option value="activity">活动</option>
                  <option value="competition">比赛</option>
                </select>
              </label>
              <label>状态
                <select [value]="formStatus()" (change)="formStatus.set($any($event.target).value)">
                  <option value="upcoming">即将开始</option>
                  <option value="ongoing">进行中</option>
                  <option value="ended">已结束</option>
                  <option value="cancelled">已取消</option>
                </select>
              </label>
            </div>
            <div class="form-row">
              <label>开始时间 <input type="datetime-local" [value]="formStartAt()" (input)="formStartAt.set($any($event.target).value)"></label>
              <label>结束时间 <input type="datetime-local" [value]="formEndAt()" (input)="formEndAt.set($any($event.target).value)"></label>
            </div>
            <div class="form-row">
              <label>
                最大人数
                <input type="number" [value]="formMaxParticipants()"
                       (input)="formMaxParticipants.set(Number($any($event.target).value))">
              </label>
            </div>
              <label>
                描述
                <textarea [value]="formDescription()" (input)="formDescription.set($any($event.target).value)" rows="3"></textarea>
              </label>
            <label>规则 <textarea [value]="formRules()" (input)="formRules.set($any($event.target).value)" rows="3"></textarea></label>
            <label>奖品 <textarea [value]="formPrizes()" (input)="formPrizes.set($any($event.target).value)" rows="2"></textarea></label>
            <div class="form-actions">
              <button type="button" (click)="closeForm()">取消</button>
              <button type="submit" class="primary" [disabled]="saving() || !canSubmit()">
                {{ saving() ? '保存中…' : editingSlug() ? '保存修改' : '创建' }}
              </button>
            </div>
            @if (formFeedback()) { <p class="form-feedback" role="alert">{{ formFeedback() }}</p> }
          </form>
        }

        @if (events().length) {
          <div class="event-admin-table">
            <table>
              <thead>
                <tr><th>标题</th><th>类型</th><th>状态</th><th>时间</th><th>人数</th><th>操作</th></tr>
              </thead>
              <tbody>
                @for (event of events(); track event.id) {
                  <tr>
                    <td><a [routerLink]="['/games/event', event.slug]">{{ event.title }}</a></td>
                    <td><span class="badge-type" [class]="event.type">{{ typeLabel(event.type) }}</span></td>
                    <td><span class="badge-status" [class]="event.status">{{ statusLabel(event.status) }}</span></td>
                    <td>{{ formatDate(event.startAt) }}</td>
                    <td>{{ event.participantCount }} / {{ event.maxParticipants || '∞' }}</td>
                    <td class="event-row-actions">
                      <button type="button" (click)="editEvent(event)">编辑</button>
                      <button type="button" (click)="deleteEvent(event.slug)"
                              [disabled]="deletingSlug() === event.slug">
                        {{ deletingSlug() === event.slug ? '删除中…' : pendingDeleteSlug() === event.slug ? '确认删除' : '删除' }}
                      </button>
                      @if (pendingDeleteSlug() === event.slug && deletingSlug() !== event.slug) {
                        <button type="button" (click)="cancelDelete()">取消</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="event-admin-empty">暂无活动，点击上方按钮创建第一个。</div>
        }
      }
    </div>
  `,
  styleUrl: './game-event-admin.component.scss'
})
export class GameEventAdminComponent implements OnInit {
  Number = Number
  private readonly http = inject(HttpClient)
  readonly eventsState = createAsyncState<GameEventAdmin[]>()
  /** 模板兼容：直接返回 data，空数组兜底 */
  readonly events = computed(() => this.eventsState.data() ?? [])
  /** 模板兼容：底层 state 的 loading 别名 */
  readonly loading = this.eventsState.loading
  showForm = signal(false)
  formFeedback = signal('')
  editingSlug = signal<string | null>(null)
  saving = signal(false)
  deletingSlug = signal<string | null>(null)
  pendingDeleteSlug = signal<string | null>(null)

  // Form fields
  formTitle = signal('')
  formSlug = signal('')
  formType = signal<'activity' | 'competition'>('activity')
  formStatus = signal<'upcoming' | 'ongoing' | 'ended' | 'cancelled'>('upcoming')
  formDescription = signal('')
  formRules = signal('')
  formPrizes = signal('')
  formStartAt = signal('')
  formEndAt = signal('')
  formMaxParticipants = signal(0)

  canSubmit = computed(() => this.formTitle().trim().length > 0 && this.formSlug().trim().length > 0)

  ngOnInit () {
    this.loadEvents()
  }

  loadEvents () {
    const data$ = this.http.get<{ total: number; data: GameEventAdmin[] }>(`${environment.apiUrl}/api/v1/games/events`).pipe(
      map(result => result.data)
    )
    this.eventsState.load(data$)
  }

  startCreate () {
    this.resetForm()
    this.editingSlug.set(null)
    this.formFeedback.set('')
    this.showForm.set(true)
  }

  editEvent (event: GameEventAdmin) {
    this.editingSlug.set(event.slug)
    this.formTitle.set(event.title)
    this.formSlug.set(event.slug)
    this.formType.set(event.type)
    this.formStatus.set(event.status)
    this.formDescription.set(event.description || '')
    this.formRules.set(event.rules || '')
    this.formPrizes.set(event.prizes || '')
    this.formStartAt.set(this.toDateTimeLocal(event.startAt))
    this.formEndAt.set(this.toDateTimeLocal(event.endAt))
    this.formMaxParticipants.set(event.maxParticipants)
    this.formFeedback.set('')
    this.showForm.set(true)
  }

  closeForm () {
    if (this.saving()) return
    this.showForm.set(false)
    this.formFeedback.set('')
  }

  submitForm () {
    if (this.saving() || !this.canSubmit()) {
      this.formFeedback.set('请填写标题和 Slug。')
      return
    }
    const validationError = this.validateForm()
    if (validationError) {
      this.formFeedback.set(validationError)
      return
    }
    const body = {
      title: this.formTitle(),
      type: this.formType(),
      status: this.formStatus(),
      description: this.formDescription() || null,
      rules: this.formRules() || null,
      prizes: this.formPrizes() || null,
      startAt: this.toIsoOrNull(this.formStartAt()),
      endAt: this.toIsoOrNull(this.formEndAt()),
      maxParticipants: this.formMaxParticipants()
    }
    if (!this.editingSlug()) Object.assign(body, { slug: this.formSlug() })
    this.saving.set(true)
    const editingSlug = this.editingSlug()
    const request = editingSlug
      ? this.http.put(`${environment.apiUrl}/api/v1/games/events/${encodeURIComponent(editingSlug)}`, body)
      : this.http.post(`${environment.apiUrl}/api/v1/games/events`, body)
    request.subscribe({
      next: () => {
        this.showForm.set(false)
        this.resetForm()
        this.editingSlug.set(null)
        this.saving.set(false)
        this.loadEvents()
        this.formFeedback.set('')
      },
      error: error => {
        this.saving.set(false)
        this.formFeedback.set(error?.error?.error || '保存失败，请检查填写内容后重试。')
      }
    })
  }

  deleteEvent (slug: string) {
    if (this.deletingSlug()) return
    if (this.pendingDeleteSlug() !== slug) {
      this.pendingDeleteSlug.set(slug)
      return
    }

    this.deletingSlug.set(slug)
    this.http.delete(`${environment.apiUrl}/api/v1/games/events/${encodeURIComponent(slug)}`).subscribe({
      next: () => {
        this.deletingSlug.set(null)
        this.pendingDeleteSlug.set(null)
        this.loadEvents()
      },
      error: () => {
        this.deletingSlug.set(null)
        this.pendingDeleteSlug.set(null)
        this.formFeedback.set('删除失败，请稍后重试')
      }
    })
  }

  cancelDelete () {
    if (!this.deletingSlug()) this.pendingDeleteSlug.set(null)
  }

  resetForm () {
    this.formTitle.set('')
    this.formSlug.set('')
    this.formType.set('activity')
    this.formStatus.set('upcoming')
    this.formDescription.set('')
    this.formRules.set('')
    this.formPrizes.set('')
    this.formStartAt.set('')
    this.formEndAt.set('')
    this.formMaxParticipants.set(0)
  }

  private toDateTimeLocal (value: string | null) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const offset = date.getTimezoneOffset()
    return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
  }

  private toIsoOrNull (value: string) {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  private validateForm () {
    const title = this.formTitle().trim()
    const slug = this.formSlug().trim().toLocaleLowerCase('en-US')
    if (title.length > 120) return '标题不能超过 120 个字符。'
    if (slug.length > 120) return 'Slug 不能超过 120 个字符。'
    if (!/^[a-z0-9\u4e00-\u9fff]+(?:-[a-z0-9\u4e00-\u9fff]+)*$/i.test(slug)) {
      return 'Slug 只能使用字母、数字、中文和连字符。'
    }
    if (this.formStartAt() && !this.toIsoOrNull(this.formStartAt())) return '开始时间格式不正确。'
    if (this.formEndAt() && !this.toIsoOrNull(this.formEndAt())) return '结束时间格式不正确。'
    const startAt = this.toIsoOrNull(this.formStartAt())
    const endAt = this.toIsoOrNull(this.formEndAt())
    if (startAt && endAt && new Date(endAt) < new Date(startAt)) return '结束时间不能早于开始时间。'
    return ''
  }

  typeLabel (type: string) {
    return type === 'activity' ? '活动' : '比赛'
  }

  statusLabel (status: string) {
    const labels: Record<string, string> = {
      upcoming: '即将开始',
      ongoing: '进行中',
      ended: '已结束',
      cancelled: '已取消'
    }
    return labels[status] || status
  }

  formatDate (date: string | null) {
    if (!date) return '待定'
    return new Date(date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }
}
