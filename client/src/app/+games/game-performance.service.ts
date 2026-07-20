import { Injectable } from '@angular/core'

type PerformanceMetric = {
  name: string
  duration: number
  timestamp: number
}

@Injectable({ providedIn: 'root' })
export class GamePerformanceService {
  private readonly metrics: PerformanceMetric[] = []
  private readonly maxMetrics = 100

  recordMetric (name: string, duration: number) {
    this.metrics.push({ name, duration, timestamp: Date.now() })
    if (this.metrics.length > this.maxMetrics) this.metrics.shift()
  }

  measure <T>(name: string, fn: () => T): T {
    const start = performance.now()
    const result = fn()
    this.recordMetric(name, performance.now() - start)
    return result
  }

  measureAsync <T>(name: string, promise: Promise<T>): Promise<T> {
    const start = performance.now()
    return promise.finally(() => this.recordMetric(name, performance.now() - start))
  }

  getMetrics () {
    return [ ...this.metrics ]
  }

  getAverageDuration (name: string): number {
    const matching = this.metrics.filter(m => m.name === name)
    if (matching.length === 0) return 0
    return matching.reduce((sum, m) => sum + m.duration, 0) / matching.length
  }

  clear () {
    this.metrics.length = 0
  }
}
