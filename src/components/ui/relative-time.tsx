'use client'

import { formatRelativeTime } from '@/lib/format/relative-time'

interface RelativeTimeProps {
  date: Date | string
  className?: string
}

/**
 * Client-safe component for displaying relative time.
 * Uses suppressHydrationWarning since the time difference between
 * server render and client hydration is acceptable for display purposes.
 */
export function RelativeTime({ date, className }: RelativeTimeProps) {
  const d = new Date(date)

  return (
    <time
      dateTime={d.toISOString()}
      className={className}
      suppressHydrationWarning
    >
      {formatRelativeTime(date)}
    </time>
  )
}
