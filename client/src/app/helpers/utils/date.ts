import { DatePipe } from '@angular/common'

let datePipe: DatePipe
let intl: Intl.DateTimeFormat

export type DateFormat = 'medium' | 'precise'

export function dateToHuman (localeId: string, date: Date, format: 'medium' | 'precise' = 'medium') {
  if (!datePipe) {
    datePipe = new DatePipe(localeId)
  }

  if (!intl) {
    intl = new Intl.DateTimeFormat(localeId, {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      year: '2-digit',
      month: 'numeric',
      day: 'numeric',
      fractionalSecondDigits: 3
    })
  }

  if (format === 'medium') return datePipe.transform(date, format)
  if (format === 'precise') return intl.format(date)
}
