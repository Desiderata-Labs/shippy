'use client'

import {
  CheckCircle,
  Circle,
  Clock,
  Contrast01,
  FileCheck02,
  Plus,
  SlashCircle01,
  Target01,
  User01,
} from '@untitled-ui/icons-react'
import { useState } from 'react'
import Link from 'next/link'
import { getLabelColor } from '@/lib/bounty/tag-colors'
import { routes } from '@/lib/routes'
import { bountyStatusColors, needsReviewColor } from '@/lib/status-colors'
import { cn } from '@/lib/utils'
import { AppButton } from '@/components/app/app-button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'

enum BountyFilter {
  All = 'all',
  Open = 'open',
  Backlog = 'backlog',
  InProgress = 'in_progress',
  NeedsReview = 'needs_review',
  Completed = 'completed',
  Closed = 'closed',
}

type Bounty = BountiesTabProps['bounties'][number]

interface BountySection {
  key: string
  label: string
  icon: React.ReactNode
  bounties: Bounty[]
}

interface BountyLabel {
  label: {
    id: string
    name: string
    color: string
  }
}

interface BountiesTabProps {
  projectSlug: string
  projectKey: string
  bounties: Array<{
    id: string
    number: number
    title: string
    description: string
    points: number | null
    labels: BountyLabel[]
    status: string
    claimMode: string
    evidenceDescription: string | null
    createdAt: Date
    claims: Array<{
      id: string
      expiresAt: Date
      user: {
        id: string
        name: string
        image: string | null
      }
    }>
    approvedSubmission: Array<{
      user: {
        id: string
        name: string
        image: string | null
      }
    }>
    _count: {
      claims: number
      submissions: number
      pendingSubmissions: number
    }
  }>
  isFounder: boolean
}

export function BountiesTab({
  projectSlug,
  projectKey,
  bounties,
  isFounder,
}: BountiesTabProps) {
  const [filter, setFilter] = useState<BountyFilter>(BountyFilter.All)

  const sortByCreatedDesc = (list: Bounty[]) =>
    [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )

  const openBounties = bounties.filter((b) => b.status === 'OPEN')
  const backlogBounties = bounties.filter((b) => b.status === 'BACKLOG')
  const needsReviewBounties = bounties.filter(
    (b) => b._count.pendingSubmissions > 0,
  )
  const inProgressBounties = bounties.filter(
    (b) => b.status === 'CLAIMED' && b._count.pendingSubmissions === 0,
  )
  const completedBounties = bounties.filter((b) => b.status === 'COMPLETED')
  const closedBounties = bounties.filter((b) => b.status === 'CLOSED')

  // Build sections for grouped display (when filter is "All")
  const sectionIconClass = 'size-4 text-muted-foreground/50'

  const sections: BountySection[] = [
    ...(isFounder && needsReviewBounties.length > 0
      ? [
          {
            key: 'needs_review',
            label: 'Needs Review',
            icon: <FileCheck02 className={sectionIconClass} />,
            bounties: sortByCreatedDesc(needsReviewBounties),
          },
        ]
      : []),
    ...(inProgressBounties.length > 0
      ? [
          {
            key: 'in_progress',
            label: 'In Progress',
            icon: <Clock className={sectionIconClass} />,
            bounties: sortByCreatedDesc(inProgressBounties),
          },
        ]
      : []),
    ...(openBounties.length > 0
      ? [
          {
            key: 'open',
            label: 'Open',
            icon: <Circle className={sectionIconClass} />,
            bounties: sortByCreatedDesc(openBounties),
          },
        ]
      : []),
    ...(completedBounties.length > 0
      ? [
          {
            key: 'completed',
            label: 'Completed',
            icon: <CheckCircle className={sectionIconClass} />,
            bounties: sortByCreatedDesc(completedBounties),
          },
        ]
      : []),
    ...(backlogBounties.length > 0
      ? [
          {
            key: 'backlog',
            label: 'Backlog',
            icon: <Contrast01 className="size-4 text-muted-foreground/50" />,
            bounties: sortByCreatedDesc(backlogBounties),
          },
        ]
      : []),
    ...(closedBounties.length > 0
      ? [
          {
            key: 'closed',
            label: 'Closed',
            icon: <SlashCircle01 className={sectionIconClass} />,
            bounties: sortByCreatedDesc(closedBounties),
          },
        ]
      : []),
  ]

  const filteredBounties = (() => {
    switch (filter) {
      case BountyFilter.Open:
        return openBounties
      case BountyFilter.Backlog:
        return backlogBounties
      case BountyFilter.InProgress:
        return inProgressBounties
      case BountyFilter.NeedsReview:
        return needsReviewBounties
      case BountyFilter.Completed:
        return completedBounties
      case BountyFilter.Closed:
        return closedBounties
      default:
        return bounties
    }
  })()

  const sortedFilteredBounties = sortByCreatedDesc(filteredBounties)

  if (bounties.length === 0) {
    return (
      <Card className="py-12 text-center">
        <div className="mx-auto flex max-w-xs flex-col items-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <Target01 className="size-6 text-primary" />
          </div>
          <h3 className="text-base font-semibold">No bounties yet</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isFounder
              ? 'Create your first bounty to attract contributors.'
              : 'Check back later for new opportunities.'}
          </p>
          {isFounder && (
            <AppButton
              size="sm"
              asChild
              className="mt-4 cursor-pointer gap-1.5"
            >
              <Link href={routes.project.newBounty({ slug: projectSlug })}>
                <Plus className="size-3.5" />
                Create Bounty
              </Link>
            </AppButton>
          )}
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          <FilterButton
            active={filter === BountyFilter.All}
            onClick={() => setFilter(BountyFilter.All)}
          >
            All ({bounties.length})
          </FilterButton>
          <FilterButton
            active={filter === BountyFilter.Open}
            onClick={() => setFilter(BountyFilter.Open)}
            disabled={openBounties.length === 0}
          >
            <span
              className={cn(
                'mr-1.5 size-2 rounded-full',
                bountyStatusColors.OPEN.dot,
              )}
            />
            Open ({openBounties.length})
          </FilterButton>
          <FilterButton
            active={filter === BountyFilter.InProgress}
            onClick={() => setFilter(BountyFilter.InProgress)}
            disabled={inProgressBounties.length === 0}
          >
            <span
              className={cn(
                'mr-1.5 size-2 rounded-full',
                bountyStatusColors.CLAIMED.dot,
              )}
            />
            In Progress ({inProgressBounties.length})
          </FilterButton>
          <FilterButton
            active={filter === BountyFilter.Completed}
            onClick={() => setFilter(BountyFilter.Completed)}
            disabled={completedBounties.length === 0}
          >
            <span
              className={cn(
                'mr-1.5 size-2 rounded-full',
                bountyStatusColors.COMPLETED.dot,
              )}
            />
            Done ({completedBounties.length})
          </FilterButton>
          <FilterButton
            active={filter === BountyFilter.Closed}
            onClick={() => setFilter(BountyFilter.Closed)}
            disabled={closedBounties.length === 0}
          >
            Closed ({closedBounties.length})
          </FilterButton>
          {backlogBounties.length > 0 && (
            <FilterButton
              active={filter === BountyFilter.Backlog}
              onClick={() => setFilter(BountyFilter.Backlog)}
            >
              <span
                className={cn(
                  'mr-1.5 size-2 rounded-full',
                  bountyStatusColors.BACKLOG.dot,
                )}
              />
              Backlog ({backlogBounties.length})
            </FilterButton>
          )}
          {isFounder && needsReviewBounties.length > 0 && (
            <FilterButton
              active={filter === BountyFilter.NeedsReview}
              onClick={() => setFilter(BountyFilter.NeedsReview)}
            >
              <FileCheck02
                className={cn('mr-1 size-3', needsReviewColor.icon)}
              />
              Review ({needsReviewBounties.length})
            </FilterButton>
          )}
        </div>
        {isFounder && (
          <AppButton size="sm" asChild className="cursor-pointer gap-1.5">
            <Link href={routes.project.newBounty({ slug: projectSlug })}>
              <Plus className="size-3.5" />
              Create
            </Link>
          </AppButton>
        )}
      </div>

      {/* Bounty list */}
      {filter === BountyFilter.All ? (
        // Grouped view by status
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.key}>
              {/* Section header */}
              <div className="sticky top-0 z-10 mb-1 flex items-center gap-2 border-b border-border/10 bg-card py-1 pr-1 pl-3">
                {section.icon}
                <span className="text-sm font-medium text-muted-foreground">
                  {section.label}
                </span>
                <span className="text-sm text-muted-foreground/50">
                  {section.bounties.length}
                </span>
              </div>
              {/* Section items */}
              <div className="space-y-2">
                {section.bounties.map((bounty) => (
                  <BountyRow
                    key={bounty.id}
                    bounty={bounty}
                    projectSlug={projectSlug}
                    projectKey={projectKey}
                    showNeedsReview={
                      isFounder && bounty._count.pendingSubmissions > 0
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : sortedFilteredBounties.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No bounties match this filter
        </div>
      ) : (
        // Flat list for filtered view
        <div className="space-y-2">
          {sortedFilteredBounties.map((bounty) => (
            <BountyRow
              key={bounty.id}
              bounty={bounty}
              projectSlug={projectSlug}
              projectKey={projectKey}
              showNeedsReview={
                isFounder && bounty._count.pendingSubmissions > 0
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex cursor-pointer items-center rounded-full px-2 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {children}
    </button>
  )
}

interface BountyRowProps {
  bounty: BountiesTabProps['bounties'][number]
  projectSlug: string
  projectKey: string
  showNeedsReview: boolean
}

function BountyRow({
  bounty,
  projectSlug,
  projectKey,
  showNeedsReview,
}: BountyRowProps) {
  const isBacklog = bounty.status === 'BACKLOG'
  const isOpen = bounty.status === 'OPEN'
  const isClaimed = bounty.status === 'CLAIMED'
  const isCompleted = bounty.status === 'COMPLETED'
  const isClosed = bounty.status === 'CLOSED'

  // Show approved submission's user if completed
  const approvedUser = bounty.approvedSubmission?.[0]?.user ?? null

  // Format date like Linear: "Aug 8"
  const dateLabel = new Date(bounty.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <Link
      href={routes.project.bountyDetail({
        slug: projectSlug,
        bountyId: bounty.id,
        title: bounty.title,
      })}
      className="group flex min-h-[44px] items-center gap-3 rounded-lg border border-border bg-card px-3 py-4 shadow-md transition-all duration-300 hover:border-primary/75 hover:shadow-lg"
    >
      {/* Status icon */}
      <span className="flex shrink-0 items-center justify-center">
        {showNeedsReview ? (
          <FileCheck02 className={cn('size-3.5', needsReviewColor.icon)} />
        ) : isCompleted ? (
          <CheckCircle
            className={cn('size-3.5', bountyStatusColors.COMPLETED.icon)}
          />
        ) : isClosed ? (
          <SlashCircle01
            className={cn('size-3.5', bountyStatusColors.CLOSED.icon)}
          />
        ) : isClaimed ? (
          <Clock className={cn('size-3.5', bountyStatusColors.CLAIMED.icon)} />
        ) : isOpen ? (
          <Circle className={cn('size-3.5', bountyStatusColors.OPEN.icon)} />
        ) : isBacklog ? (
          <Contrast01 className="size-3.5 text-muted-foreground/50" />
        ) : (
          <Circle className="size-3.5 text-muted-foreground" />
        )}
      </span>

      {/* Issue key: "OTH-32" */}
      <span className="shrink-0 text-xs text-muted-foreground">
        {projectKey}-{bounty.number}
      </span>

      {/* Title */}
      <span className="min-w-0 flex-1 truncate text-sm transition-colors">
        {bounty.title}
      </span>

      {/* Labels (Linear-style: dot + border, no bg) */}
      <span className="hidden shrink-0 items-center gap-1.5 lg:flex">
        {bounty.labels.slice(0, 3).map(({ label }) => {
          const color = getLabelColor(label.color)
          return (
            <span
              key={label.id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                color.border,
                color.text,
              )}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: color.dot }}
              />
              {label.name}
            </span>
          )
        })}
      </span>

      {/* Needs review badge (founder only) */}
      {showNeedsReview && (
        <span
          className={cn(
            'hidden shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:flex',
            needsReviewColor.badge,
          )}
        >
          <FileCheck02 className="size-3" />
          {bounty._count.pendingSubmissions}
        </span>
      )}

      {/* Points (subtle, like a label) */}
      <span
        className={cn(
          'hidden shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold sm:block',
          bounty.points !== null
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {bounty.points !== null ? `${bounty.points} pts` : 'TBD'}
      </span>

      {/* Assignee avatars (stacked, up to 3 shown) */}
      {(() => {
        // Show approved user first if completed, then claimants
        const assignees = approvedUser
          ? [approvedUser]
          : bounty.claims.map((c) => c.user).slice(0, 3)
        const totalCount = approvedUser ? 1 : bounty.claims.length

        if (assignees.length === 0) {
          return (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/30">
              <User01 className="size-2.5 text-muted-foreground/40" />
            </span>
          )
        }

        return (
          <div className="flex shrink-0 items-center">
            <div className="flex -space-x-1.5">
              {assignees.map((user, idx) => (
                <Avatar
                  key={user.id}
                  className="size-5 ring-2 ring-card"
                  style={{ zIndex: assignees.length - idx }}
                >
                  <AvatarImage src={user.image ?? undefined} />
                  <AvatarFallback className="text-[9px]">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            {totalCount > 3 && (
              <span className="ml-1 text-[10px] text-muted-foreground">
                +{totalCount - 3}
              </span>
            )}
          </div>
        )
      })()}

      {/* Date */}
      <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
        {dateLabel}
      </span>
    </Link>
  )
}
