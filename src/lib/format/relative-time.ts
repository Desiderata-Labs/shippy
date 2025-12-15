/**
 * Format a date as relative time (e.g., "2m ago", "3h ago", "5d ago")
 * Falls back to absolute date for dates older than 1 year
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  // Over 1 year: show full date
  if (diffYears >= 1) {
    return then.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Over 30 days: show month and day
  if (diffMonths >= 1) {
    return then.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  // Over 7 days: show weeks
  if (diffWeeks >= 1) {
    return `${diffWeeks}w ago`
  }

  // Over 1 day: show days
  if (diffDays >= 1) {
    return `${diffDays}d ago`
  }

  // Over 1 hour: show hours
  if (diffHours >= 1) {
    return `${diffHours}h ago`
  }

  // Over 1 minute: show minutes
  if (diffMinutes >= 1) {
    return `${diffMinutes}m ago`
  }

  // Less than a minute
  return 'just now'
}
