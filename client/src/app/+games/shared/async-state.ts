import { Injectable, signal, computed, inject } from '@angular/core'
import { Observable } from 'rxjs'

/**
 * 异步资源状态管理工具
 *
 * 统一封装 loading/error/data 三态，消除各组件重复的 signal 样板代码。
 *
 * 用法：
 *   const state = createAsyncState<Game[]>()
 *   state.load(this.gamesService.list())
 *   // 模板：state.loading() / state.error() / state.data()
 */
export interface AsyncState<T> {
  /** 当前数据 */
  readonly data: ReturnType<typeof signal<T | null>>
  /** 加载中标志 */
  readonly loading: ReturnType<typeof signal<boolean>>
  /** 错误标志（true 表示加载失败） */
  readonly error: ReturnType<typeof signal<boolean>>
  /** 错误消息（可选） */
  readonly errorMessage: ReturnType<typeof signal<string>>
  /** 是否有数据 */
  readonly hasData: ReturnType<typeof computed<boolean>>
  /** 是否为空（加载完成但无数据） */
  readonly isEmpty: ReturnType<typeof computed<boolean>>

  /** 从 Observable 加载数据，自动管理三态 */
  load (source$: Observable<T>): void
  /** 重置为初始状态 */
  reset (): void
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
  const error = signal(false)
  const errorMessage = signal('')

  const hasData = computed(() => data() !== null)
  const isEmpty = computed(() => {
    const current = data()
    if (loading() || error()) return false
    if (current === null) return true
    if (Array.isArray(current)) return current.length === 0
    return false
  })

  const state: AsyncState<T> = {
    data,
    loading,
    error,
    errorMessage,
    hasData,
    isEmpty,
    load (source$: Observable<T>) {
      loading.set(true)
      error.set(false)
      errorMessage.set('')
      source$.subscribe({
        next: result => {
          data.set(result)
          loading.set(false)
        },
        error: err => {
          loading.set(false)
          error.set(true)
          errorMessage.set(typeof err === 'string' ? err : (err?.message || '加载失败'))
        }
      })
    },
    reset () {
      data.set(initial)
      loading.set(false)
      error.set(false)
      errorMessage.set('')
    }
  }

  return state
}
