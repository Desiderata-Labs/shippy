'use client'

import { useState } from 'react'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { AppButton } from '@/components/app'

interface NotFoundStateProps {
  /** The type of resource that wasn't found */
  resourceType?:
    | 'project'
    | 'bounty'
    | 'submission'
    | 'user'
    | 'page'
    | 'payout'
  /** Optional custom title */
  title?: string
  /** Optional custom description */
  description?: string
  /** Optional back link - defaults to discover page */
  backHref?: string
  /** Optional back link text */
  backLabel?: string
  /** Additional className for the container */
  className?: string
}

const ghostMessages = [
  'Boo! This page has vanished into thin air.',
  'Looks like this one shipped... to another dimension.',
  'This page got lost at sea.',
  "Spooky! You've sailed past the edge of the map.",
  "Our ghost checked the manifest. This page isn't on it.",
  "You've drifted into uncharted waters.",
]

const resourceMessages: Record<string, { title: string; description: string }> =
  {
    project: {
      title: 'Project not found',
      description:
        "This project may have been deleted or you don't have access to it.",
    },
    bounty: {
      title: 'Bounty not found',
      description:
        "This bounty may have been removed or doesn't exist anymore.",
    },
    submission: {
      title: 'Submission not found',
      description: "This submission may have been withdrawn or doesn't exist.",
    },
    user: {
      title: 'User not found',
      description: "This profile doesn't exist or may have been removed.",
    },
    payout: {
      title: 'Payout not found',
      description: "This payout record doesn't exist or you don't have access.",
    },
    page: {
      title: 'Page not found',
      description: "The page you're looking for doesn't exist.",
    },
  }

export function NotFoundState({
  resourceType = 'page',
  title,
  description,
  backHref,
  backLabel,
  className,
}: NotFoundStateProps) {
  // Initialize random message once on mount to avoid hydration mismatch
  const [randomMessage] = useState(
    () => ghostMessages[Math.floor(Math.random() * ghostMessages.length)],
  )
  const resourceInfo = resourceMessages[resourceType] || resourceMessages.page

  const displayTitle = title || resourceInfo.title
  const displayDescription = description || resourceInfo.description
  const displayBackHref = backHref || routes.discover.root()
  const displayBackLabel = backLabel || 'Back to Discover'

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
          <div className="size-20 rounded-full bg-primary/20" />
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
        {displayTitle}
      </h2>

      {/* Description */}
      <p className="mt-2 max-w-4xl text-muted-foreground">
        {displayDescription}
      </p>

      {/* Back button */}
      <AppButton asChild variant="outline" className="mt-6">
        <Link href={displayBackHref}>{displayBackLabel}</Link>
      </AppButton>
    </div>
  )
}
