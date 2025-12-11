'use client'

import {
  ArrowRight,
  Clock,
  FileCheck02,
  Plus,
  Target01,
  Users01,
} from '@untitled-ui/icons-react'
import { useState } from 'react'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { GlassCard } from './glass-card'

enum BountyFilter {
  All = 'all',
  Open = 'open',
  InProgress = 'in_progress',
  NeedsReview = 'needs_review',
}

interface BountiesTabProps {
  projectSlug: string
  bounties: Array<{
    id: string
    title: string
    description: string
    points: number
    tags: string[]
    status: string
    claimMode: string
    evidenceDescription: string | null
    createdAt: Date
    _count: {
      claims: number
      submissions: number
      pendingSubmissions: number
    }
  }>
  isFounder: boolean
}

const tagColors: Record<string, string> = {
  GROWTH: 'border-green-500/20 bg-green-500/10 text-green-500',
  SALES: 'border-blue-500/20 bg-blue-500/10 text-blue-500',
  CONTENT: 'border-purple-500/20 bg-purple-500/10 text-purple-500',
  DESIGN: 'border-pink-500/20 bg-pink-500/10 text-pink-500',
  DEV: 'border-orange-500/20 bg-orange-500/10 text-orange-500',
}

export function BountiesTab({
  projectSlug,
  bounties,
  isFounder,
}: BountiesTabProps) {
  const [filter, setFilter] = useState<BountyFilter>(BountyFilter.All)

  const openBounties = bounties.filter((b) => b.status === 'OPEN')
  // Needs Review: has pending submissions (takes priority over "In Progress")
  const needsReviewBounties = bounties.filter(
    (b) => b._count.pendingSubmissions > 0,
  )
  // In Progress: claimed but NO pending submissions (those go to Needs Review)
  const inProgressBounties = bounties.filter(
    (b) => b.status === 'CLAIMED' && b._count.pendingSubmissions === 0,
  )

  // Apply filter
  const filteredBounties = (() => {
    switch (filter) {
      case BountyFilter.Open:
        return openBounties
      case BountyFilter.InProgress:
        return inProgressBounties
      case BountyFilter.NeedsReview:
        return needsReviewBounties
      default:
        return bounties
    }
  })()

  if (bounties.length === 0) {
    return (
      <GlassCard className="py-12 text-center">
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
            <Button size="sm" asChild className="mt-4 cursor-pointer gap-1.5">
              <Link href={routes.project.newBounty({ slug: projectSlug })}>
                <Plus className="size-3.5" />
                Create Bounty
              </Link>
            </Button>
          )}
        </div>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter buttons and action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={filter === BountyFilter.All ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter(BountyFilter.All)}
            className="h-7 cursor-pointer px-2.5 text-xs"
          >
            All ({bounties.length})
          </Button>
          <Button
            variant={filter === BountyFilter.Open ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter(BountyFilter.Open)}
            className="h-7 cursor-pointer px-2.5 text-xs"
            disabled={openBounties.length === 0}
          >
            <div className="mr-1.5 size-2 rounded-full bg-green-500" />
            {openBounties.length} open
          </Button>
          <Button
            variant={filter === BountyFilter.InProgress ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter(BountyFilter.InProgress)}
            className="h-7 cursor-pointer px-2.5 text-xs"
            disabled={inProgressBounties.length === 0}
          >
            <div className="mr-1.5 size-2 rounded-full bg-yellow-500" />
            {inProgressBounties.length} in progress
          </Button>
          {isFounder && (
            <Button
              variant={
                filter === BountyFilter.NeedsReview ? 'secondary' : 'ghost'
              }
              size="sm"
              onClick={() => setFilter(BountyFilter.NeedsReview)}
              className="h-7 cursor-pointer px-2.5 text-xs"
              disabled={needsReviewBounties.length === 0}
            >
              <FileCheck02 className="mr-1.5 size-3 text-purple-500" />
              {needsReviewBounties.length} needs review
            </Button>
          )}
        </div>
        {isFounder && (
          <Button size="sm" asChild className="cursor-pointer gap-1.5">
            <Link href={routes.project.newBounty({ slug: projectSlug })}>
              <Plus className="size-3.5" />
              Create Bounty
            </Link>
          </Button>
        )}
      </div>

      {/* Bounty List */}
      {filteredBounties.length === 0 ? (
        <GlassCard className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No bounties match this filter
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-2">
          {filteredBounties.map((bounty) => (
            <BountyCard
              key={bounty.id}
              bounty={bounty}
              projectSlug={projectSlug}
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

interface BountyCardProps {
  bounty: BountiesTabProps['bounties'][number]
  projectSlug: string
  showNeedsReview?: boolean
}

function BountyCard({ bounty, projectSlug, showNeedsReview }: BountyCardProps) {
  const isClaimed = bounty.status === 'CLAIMED'

  return (
    <Link
      href={routes.project.bountyDetail({
        slug: projectSlug,
        bountyId: bounty.id,
      })}
      className="group block"
    >
      <GlassCard
        className={cn(
          'p-4 transition-all duration-200 hover:ring-1 hover:ring-primary/20',
          showNeedsReview && 'ring-1 ring-purple-500/30',
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: Title and description */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-medium transition-colors group-hover:text-primary">
                {bounty.title}
              </h4>
              {isClaimed && (
                <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-500">
                  Claimed
                </span>
              )}
              {showNeedsReview && (
                <span className="flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-500">
                  <FileCheck02 className="size-2.5" />
                  {bounty._count.pendingSubmissions} to review
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {bounty.description}
            </p>

            {/* Tags */}
            {bounty.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {bounty.tags.map((tag) => (
                  <span
                    key={tag}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                      tagColors[tag] ||
                        'border-border bg-muted text-muted-foreground',
                    )}
                  >
                    {tag.toLowerCase()}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right: Points badge */}
          <div className="flex shrink-0 items-center gap-3">
            <div className="rounded-lg bg-primary/10 px-3 py-1.5 text-center">
              <p className="text-base font-bold text-primary">
                +{bounty.points}
              </p>
              <p className="text-[10px] text-muted-foreground">points</p>
            </div>

            {/* Arrow on hover */}
            <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100" />
          </div>
        </div>

        {/* Footer meta */}
        <div className="mt-3 flex items-center gap-3 border-t border-border pt-3 text-[10px] text-muted-foreground">
          {bounty.claimMode === 'SINGLE' ? (
            <span className="flex items-center gap-1">
              <Users01 className="size-3" />
              Single claim
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Users01 className="size-3" />
              {bounty._count.claims} claimed
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {new Date(bounty.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </GlassCard>
    </Link>
  )
}
