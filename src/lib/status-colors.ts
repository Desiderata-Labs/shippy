/**
 * Centralized status color definitions for bounties and submissions.
 * Use these consistently across all UI components.
 */
import { BountyStatus, SubmissionStatus } from '@/lib/db/types'

// =============================================================================
// BOUNTY STATUS COLORS
// =============================================================================
// Open: Primary - ready to claim, inviting
// Claimed/In Progress: Yellow - someone is working on it
// Completed: Primary - done successfully
// Closed: Muted - no longer active

export const bountyStatusColors = {
  [BountyStatus.OPEN]: {
    dot: 'bg-primary',
    text: 'text-primary',
    icon: 'text-primary',
  },
  [BountyStatus.CLAIMED]: {
    dot: 'bg-yellow-500',
    text: 'text-yellow-500',
    icon: 'text-yellow-500',
  },
  [BountyStatus.COMPLETED]: {
    dot: 'bg-primary',
    text: 'text-primary',
    icon: 'text-primary',
  },
  [BountyStatus.CLOSED]: {
    dot: 'bg-muted-foreground/50',
    text: 'text-muted-foreground/50',
    icon: 'text-muted-foreground/50',
  },
} as const

export const bountyStatusLabels: Record<BountyStatus, string> = {
  [BountyStatus.OPEN]: 'Open',
  [BountyStatus.CLAIMED]: 'In Progress',
  [BountyStatus.COMPLETED]: 'Done',
  [BountyStatus.CLOSED]: 'Closed',
}

// =============================================================================
// SUBMISSION STATUS COLORS
// =============================================================================
// Draft: Muted - not yet submitted
// Pending: Purple - awaiting review (attention needed)
// Needs Info: Amber - waiting for contributor response
// Approved: Primary - success
// Rejected: Red - not accepted
// Withdrawn: Muted - cancelled by contributor

export const submissionStatusColors = {
  [SubmissionStatus.DRAFT]: {
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
    icon: 'text-muted-foreground',
  },
  [SubmissionStatus.PENDING]: {
    dot: 'bg-purple-500',
    text: 'text-purple-500',
    icon: 'text-purple-500',
  },
  [SubmissionStatus.NEEDS_INFO]: {
    dot: 'bg-amber-500',
    text: 'text-amber-500',
    icon: 'text-amber-500',
  },
  [SubmissionStatus.APPROVED]: {
    dot: 'bg-primary',
    text: 'text-primary',
    icon: 'text-primary',
  },
  [SubmissionStatus.REJECTED]: {
    dot: 'bg-red-500',
    text: 'text-red-500',
    icon: 'text-red-500',
  },
  [SubmissionStatus.WITHDRAWN]: {
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
    icon: 'text-muted-foreground',
  },
} as const

export const submissionStatusLabels: Record<SubmissionStatus, string> = {
  [SubmissionStatus.DRAFT]: 'Draft',
  [SubmissionStatus.PENDING]: 'Pending Review',
  [SubmissionStatus.NEEDS_INFO]: 'Needs Info',
  [SubmissionStatus.APPROVED]: 'Approved',
  [SubmissionStatus.REJECTED]: 'Rejected',
  [SubmissionStatus.WITHDRAWN]: 'Withdrawn',
}

// =============================================================================
// SPECIAL FILTER: NEEDS REVIEW
// =============================================================================
// Used for the "Needs Review" filter on bounties list (founder view)
// Uses purple to match pending submission status - these are related concepts

export const needsReviewColor = {
  dot: 'bg-purple-500',
  text: 'text-purple-500',
  icon: 'text-purple-500',
  badge: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
}
