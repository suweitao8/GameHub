import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink } from '@angular/router'
import { HttpClient } from '@angular/common/http'
import { map } from 'rxjs/operators'
import { environment } from '../../environments/environment'
import { AuthService } from '@app/core/auth/auth.service'
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
  maxParticipants: number
  participantCount: number
  createdAt: string
}

@Component({
  selector: 'my-game-event-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, GlobalIconComponent],
  template: `
    <div class="event-admin-container">
      <div class="event-admin-header">
        <h2>活动管理</h2>
        <p>创建和管理社区活动与比赛</p>
      </div>

      @if (loading()) {
        <div class="event-admin-skeleton">
          <div class="admin-skeleton-row shimmer" *ngFor="let _ of [1,2,3]"></div>
        </div>
      } @else {
        <div class="event-admin-actions">
          <button type="button" class="create-event-btn" (click)="showForm.set(true)">
            <my-global-icon iconName="plus" /> 创建活动
          </button>
        </div>

        @if (showForm()) {
          <form class="event-form" (submit)="$event.preventDefault(); submitForm()">
            <div class="form-row">
              <label>标题 <input [value]="formTitle()" (input)="formTitle.set($any($event.target).value)" required></label>
              <label>Slug <input [value]="formSlug()" (input)="formSlug.set($any($event.target).value)" required></label>
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
              <label>最大人数 <input type="number" [value]="formMaxParticipants()" (input)="formMaxParticipants.set(Number($any($event.target).value))"></label>
            </div>
            <label>描述 <textarea [value]="formDescription()" (input)="formDescription.set($any($event.target).value)" rows="3"></textarea></label>
            <label>规则 <textarea [value]="formRules()" (input)="formRules.set($any($event.target).value)" rows="3"></textarea></label>
            <label>奖品 <textarea [value]="formPrizes()" (input)="formPrizes.set($any($event.target).value)" rows="2"></textarea></label>
            <div class="form-actions">
              <button type="button" (click)="showForm.set(false)">取消</button>
              <button type="submit" class="primary">创建</button>
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
                    <td><button type="button" (click)="deleteEvent(event.slug)">删除</button></td>
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
  styles: [`
    .event-admin-container { max-width: 1200px; margin: 0 auto; padding: 1rem; }

    .event-admin-header { margin-bottom: 1.5rem; }
    .event-admin-header h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .event-admin-header p { color: var(--game-muted); font-size: 0.9rem; margin: 0; }

    .event-admin-actions { margin-bottom: 1rem; }

    .create-event-btn {
      align-items: center;
      background: var(--game-brand);
      border: 1px solid var(--game-brand);
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
      display: inline-flex;
      font-size: 0.9rem;
      font-weight: 700;
      gap: 0.35rem;
      padding: 0.55rem 1rem;
    }

    .event-form {
      background: #fff;
      border: 1px solid var(--game-border);
      border-radius: var(--game-radius);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      padding: 1.25rem;
    }

    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    @media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } }

    .event-form label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.82rem; color: var(--game-muted); }
    .event-form input, .event-form select, .event-form textarea {
      border: 1px solid var(--game-border);
      border-radius: 4px;
      padding: 0.4rem 0.5rem;
      font-size: 0.88rem;
    }

    .form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem; }
    .form-actions button { padding: 0.4rem 0.85rem; border-radius: 4px; border: 1px solid var(--game-border); background: #fff; cursor: pointer; }
    .form-actions button.primary { background: var(--game-brand); border-color: var(--game-brand); color: #fff; font-weight: 700; }

    .event-admin-table { overflow-x: auto; }
    .event-admin-table table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .event-admin-table th, .event-admin-table td { padding: 0.65rem; text-align: left; border-bottom: 1px solid var(--game-border); }
    .event-admin-table th { color: var(--game-muted); font-weight: 600; }
    .event-admin-table a { color: var(--game-text); text-decoration: none; font-weight: 600; }
    .event-admin-table a:hover { color: var(--game-brand); }

    .badge-type, .badge-status { display: inline-block; font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 4px; text-transform: uppercase; }
    .badge-type.activity { background: #e0f2fe; color: #0369a1; }
    .badge-type.competition { background: #fef3c7; color: #92400e; }
    .badge-status.upcoming { background: #dcfce7; color: #166534; }
    .badge-status.ongoing { background: #dbeafe; color: #1e40af; }
    .badge-status.ended { background: #f3f4f6; color: #4b5563; }
    .badge-status.cancelled { background: #fee2e2; color: #991b1b; }

    .event-admin-empty { text-align: center; padding: 3rem; color: var(--game-muted); }
    .event-admin-skeleton { display: flex; flex-direction: column; gap: 0.5rem; }
    .admin-skeleton-row { height: 2.5rem; border-radius: 4px; }
  `]
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

  ngOnInit () {
    this.loadEvents()
  }

  loadEvents () {
    const data$ = this.http.get<{ total: number; data: GameEventAdmin[] }>(`${environment.apiUrl}/api/v1/games/events`).pipe(
      map(result => result.data)
    )
    this.eventsState.load(data$)
  }

  submitForm () {
    const body = {
      title: this.formTitle(),
      slug: this.formSlug(),
      type: this.formType(),
      status: this.formStatus(),
      description: this.formDescription() || null,
      rules: this.formRules() || null,
      prizes: this.formPrizes() || null,
      startAt: this.formStartAt() || null,
      endAt: this.formEndAt() || null,
      maxParticipants: this.formMaxParticipants()
    }
    this.http.post(`${environment.apiUrl}/api/v1/games/events`, body).subscribe({
      next: () => {
        this.showForm.set(false)
        this.resetForm()
        this.loadEvents()
        this.formFeedback.set('')
      },
      error: () => {
        this.formFeedback.set('保存失败，请检查 Slug 是否唯一后重试')
      }
    })
  }

  deleteEvent (slug: string) {
    if (!confirm('确定删除这个活动吗？')) return
    this.http.delete(`${environment.apiUrl}/api/v1/games/events/${slug}`).subscribe({
      next: () => this.loadEvents(),
      error: () => { this.formFeedback.set('删除失败，请稍后重试') }
    })
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
