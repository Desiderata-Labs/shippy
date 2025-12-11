'use client'

import {
  ArrowRight,
  Clock,
  Plus,
  Target01,
  Users01,
} from '@untitled-ui/icons-react'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { GlassCard } from './glass-card'

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
  const openBounties = bounties.filter((b) => b.status === 'OPEN')
  const claimedBounties = bounties.filter((b) => b.status === 'CLAIMED')

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
    <div className="space-y-6">
      {/* Header with action */}
      {isFounder && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {openBounties.length} open, {claimedBounties.length} in progress
          </p>
          <Button size="sm" asChild className="cursor-pointer gap-1.5">
            <Link href={routes.project.newBounty({ slug: projectSlug })}>
              <Plus className="size-3.5" />
              Create Bounty
            </Link>
          </Button>
        </div>
      )}

      {/* Open Bounties */}
      {openBounties.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-1.5">
            <div className="size-1.5 rounded-full bg-green-500" />
            <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Open ({openBounties.length})
            </h3>
          </div>
          <div className="grid gap-2">
            {openBounties.map((bounty) => (
              <BountyCard
                key={bounty.id}
                bounty={bounty}
                projectSlug={projectSlug}
              />
            ))}
          </div>
        </section>
      )}

      {/* In Progress Bounties */}
      {claimedBounties.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-1.5">
            <div className="size-1.5 rounded-full bg-yellow-500" />
            <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              In Progress ({claimedBounties.length})
            </h3>
          </div>
          <div className="grid gap-2">
            {claimedBounties.map((bounty) => (
              <BountyCard
                key={bounty.id}
                bounty={bounty}
                projectSlug={projectSlug}
                muted
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

interface BountyCardProps {
  bounty: BountiesTabProps['bounties'][number]
  projectSlug: string
  muted?: boolean
}

function BountyCard({ bounty, projectSlug, muted }: BountyCardProps) {
  const isOpen = bounty.status === 'OPEN'

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
          'p-4 transition-all duration-200',
          muted && 'opacity-60 hover:opacity-80',
          !muted && 'hover:ring-1 hover:ring-primary/20',
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: Title and description */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium transition-colors group-hover:text-primary">
                {bounty.title}
              </h4>
              {!isOpen && (
                <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-500">
                  Claimed
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
