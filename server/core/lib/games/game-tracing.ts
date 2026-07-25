import { wrapWithSpanAndContext } from '@server/lib/opentelemetry/tracing.js'

export function traceGameOperation<T> (operation: string, fn: () => Promise<T>): Promise<T> {
  return wrapWithSpanAndContext(`peertube.Game.${operation}`, fn)
}
