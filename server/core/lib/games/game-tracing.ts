import { tracer, wrapWithSpanAndContext } from '@server/lib/opentelemetry/tracing.js'

export function traceGameOperation<T> (operation: string, fn: () => Promise<T>): Promise<T> {
  return wrapWithSpanAndContext(`peertube.Game.${operation}`, fn)
}

export function traceGameSpan (operation: string) {
  const span = tracer.startSpan(`peertube.Game.${operation}`)
  return {
    end () { span.end() }
  }
}
