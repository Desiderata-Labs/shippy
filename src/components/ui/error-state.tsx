'use client'

import { useState } from 'react'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { AppButton } from '@/components/app'

interface ErrorStateProps {
  /** The error message to display */
  message?: string
  /** Error ID for support reference (from tRPC error formatter) */
  errorId?: string
  /** Optional back link - defaults to discover page */
  backHref?: string
  /** Optional back link text */
  backLabel?: string
  /** Optional retry callback */
  onRetry?: () => void
  /** Additional className for the container */
  className?: string
}

const ghostMessages = [
  'Our ghost ran into some turbulence.',
  'Even ghosts have bad days sometimes.',
  "Something went sideways. We're on it.",
]

export function ErrorState({
  message,
  errorId,
  backHref,
  backLabel,
  onRetry,
  className,
}: ErrorStateProps) {
  const [randomMessage] = useState(
    () => ghostMessages[Math.floor(Math.random() * ghostMessages.length)],
  )
  const [copied, setCopied] = useState(false)

  const displayBackHref = backHref || routes.discover.root()
  const displayBackLabel = backLabel || 'Back to Discover'

  const handleCopyErrorId = async () => {
    if (!errorId) return
    await navigator.clipboard.writeText(errorId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 text-center',
        className,
      )}
    >
      {/* Ghost logo with floating animation */}
      <div className="relative mb-2">
        <div className="animate-float">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt=""
            className="size-20 opacity-60"
            aria-hidden="true"
          />
        </div>
        {/* Subtle glow effect */}
        <div className="absolute inset-0 -z-10 blur-2xl">
          <div className="size-20 rounded-full bg-destructive/20" />
        </div>
      </div>

      {/* Fun ghost message - suppressHydrationWarning because we intentionally randomize on client */}
      <p
        className="mb-2 text-sm text-muted-foreground/70 italic"
        suppressHydrationWarning
      >
        {randomMessage}
      </p>

      {/* Main title */}
      <h2 className="mt-10 text-xl font-semibold tracking-tight">
        Something went wrong
      </h2>

      {/* Description */}
      <p className="mt-2 max-w-sm text-muted-foreground">
        {message || 'We hit an unexpected error. Please try again.'}
      </p>

      {/* Error ID for support */}
      {errorId && (
        <div className="mt-4 rounded-md border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            If this keeps happening, contact us with reference ID:{' '}
            <button
              type="button"
              onClick={handleCopyErrorId}
              className="cursor-pointer font-mono text-foreground hover:underline"
            >
              {errorId}
            </button>
            {copied && <span className="ml-2 text-green-500">Copied!</span>}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        {onRetry && (
          <AppButton onClick={onRetry} variant="outline">
            Try Again
          </AppButton>
        )}
        <AppButton asChild variant={onRetry ? 'ghost' : 'outline'}>
          <Link href={displayBackHref}>{displayBackLabel}</Link>
        </AppButton>
      </div>
    </div>
  )
}
