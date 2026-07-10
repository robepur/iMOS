import type { ReviewPeriod } from '../localData'

const SHORT_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const LONG_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
const DATETIME_FORMATTER = new Intl.DateTimeFormat('en-US')
const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

export function formatDate(iso: string): string {
  return SHORT_FORMATTER.format(new Date(iso))
}

export function formatDateLong(iso: string): string {
  return LONG_FORMATTER.format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return DATETIME_FORMATTER.format(new Date(iso))
}

export function formatTime(iso: string): string {
  return TIME_FORMATTER.format(new Date(iso))
}

export function getPeriodStart(period: ReviewPeriod): Date {
  const now = new Date()
  switch (period) {
    case 'today': return new Date(now.toDateString())
    case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case 'month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case 'quarter': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    default: return new Date(0)
  }
}

export function isInPeriod(isoDate: string, period: ReviewPeriod): boolean {
  if (period === 'all') return true
  return new Date(isoDate) >= getPeriodStart(period)
}

export function isOverdue(due: string): boolean {
  return Boolean(due) && new Date(due) < new Date(new Date().toDateString())
}

export function todayISO(): string {
  return new Date().toDateString()
}
