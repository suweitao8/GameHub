import { signal, computed } from '@angular/core'
import { forkJoin, Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { getGameActionErrorMessage } from '../game-action-feedback'

/**
 * 异步资源状态管理工具
 *
 * 统一封装 loading/error/data 三态，消除各组件重复的 signal 样板代码。
 *
 * 用法：
 *   const state = createAsyncState<Game[]>()
 *   state.load(this.gamesService.list())
 *   // 模板：state.loading() / state.hasError() / state.data() / state.isEmpty()
 *
 * 多源并发：
 *   const state = createAsyncState<{ latest: Game[]; popular: Game[] }>()
 *   state.loadMulti({ latest: ..., popular: ... })
 *
 * 分页追加：
 *   state.loadMore(this.gamesService.list({ start: offset }))
 */
export interface AsyncState<T> {
  /** 当前数据 */
  readonly data: ReturnType<typeof signal<T | null>>
  /** 加载中标志 */
  readonly loading: ReturnType<typeof signal<boolean>>
  /** 错误消息（空字符串 = 无错误）；保留为可写信号便于直接设置自定义消息 */
  readonly error: ReturnType<typeof signal<string>>
  /** 是否处于错误态（error 非空） */
  readonly hasError: ReturnType<typeof computed<boolean>>
  /** 是否有数据 */
  readonly hasData: ReturnType<typeof computed<boolean>>
  /** 是否为空（加载完成但无数据） */
  readonly isEmpty: ReturnType<typeof computed<boolean>>
  /** 加载更多分页标志 */
  readonly loadingMore: ReturnType<typeof signal<boolean>>

  /** 从单个 Observable 加载数据，自动管理三态 */
  load (source$: Observable<T>): void
  /** 从多个 Observable 并发加载并合并为对象 data；forkJoin 语义，全部完成才写入 */
  loadMulti<T2 extends Record<string, Observable<any>>> (sources: T2): void
  /** 加载更多：将 Observable<T[]> 的结果拼接到现有数组 data 末尾 */
  loadMore (source$: Observable<T extends (infer U)[] ? U[] : never>): void
  /** 重置为初始状态 */
  reset (): void
}

/** 解析错误为展示消息：优先 getGameActionErrorMessage，其次 err.message，最后兜底 */
function resolveErrorMessage (err: unknown): string {
  const fromHelper = getGameActionErrorMessage(err)
  if (fromHelper) return fromHelper
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (typeof err === 'string' && err.trim()) return err
  return '加载失败'
}

/**
 * 创建异步状态实例
 *
 * @param initial 初始数据（默认 null）
 * @returns AsyncState 实例，可直接在组件中使用
 */
export function createAsyncState<T> (initial: T | null = null): AsyncState<T> {
  const data = signal<T | null>(initial)
  const loading = signal(false)
  const error = signal('')
  const loadingMore = signal(false)
  let requestGeneration = 0

  const hasError = computed(() => error().length > 0)
  const hasData = computed(() => data() !== null)
  const isEmpty = computed(() => {
    const current = data()
    if (loading() || hasError()) return false
    if (current === null) return true
    if (Array.isArray(current)) return current.length === 0
    return false
  })

  const state: AsyncState<T> = {
    data,
    loading,
    error,
    hasError,
    hasData,
    isEmpty,
    loadingMore,
    load (source$: Observable<T>) {
      const generation = ++requestGeneration
      loading.set(true)
      error.set('')
      loadingMore.set(false)
      source$.subscribe({
        next: result => {
          if (generation !== requestGeneration) return
          data.set(result)
          loading.set(false)
        },
        error: err => {
          if (generation !== requestGeneration) return
          loading.set(false)
          error.set(resolveErrorMessage(err))
        }
      })
    },
    loadMulti<T2 extends Record<string, Observable<any>>> (sources: T2) {
      const generation = ++requestGeneration
      loading.set(true)
      error.set('')
      loadingMore.set(false)
      const merged = forkJoin(sources).pipe(
        map(result => result as unknown as T)
      )
      merged.subscribe({
        next: result => {
          if (generation !== requestGeneration) return
          data.set(result)
          loading.set(false)
        },
        error: err => {
          if (generation !== requestGeneration) return
          loading.set(false)
          error.set(resolveErrorMessage(err))
        }
      })
    },
    loadMore (source$: Observable<T extends (infer U)[] ? U[] : never>) {
      const generation = requestGeneration
      loadingMore.set(true)
      source$.subscribe({
        next: result => {
          if (generation !== requestGeneration) return
          const current = data()
          const arr = Array.isArray(current) ? (current as unknown[]) : []
          // result 是数组；拼接后写回 data
          const next = [ ...arr, ...(result as unknown[]) ] as unknown as T
          data.set(next)
          loadingMore.set(false)
        },
        error: err => {
          if (generation !== requestGeneration) return
          loadingMore.set(false)
          // 加载更多失败只回写 loadingMore，不覆盖主 data 与 error
          // 避免已加载列表被清空；上层可据 loadingMore=false 自行提示
          void err
        }
      })
    },
    reset () {
      requestGeneration += 1
      data.set(initial)
      loading.set(false)
      error.set('')
      loadingMore.set(false)
    }
  }

  return state
}
