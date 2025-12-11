'use client'

import { Clock, Target01, Users01 } from '@untitled-ui/icons-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface BountiesTabProps {
  projectId: string
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
  GROWTH: 'bg-green-500/10 text-green-600 dark:text-green-400',
  SALES: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  CONTENT: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  DESIGN: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  DEV: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
}

export function BountiesTab({
  projectId,
  bounties,
  isFounder,
}: BountiesTabProps) {
  const openBounties = bounties.filter((b) => b.status === 'OPEN')
  const claimedBounties = bounties.filter((b) => b.status === 'CLAIMED')

  if (bounties.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Target01 className="mb-4 size-12 text-muted-foreground" />
          <h3 className="text-xl font-semibold">No bounties yet</h3>
          <p className="mt-2 max-w-sm text-muted-foreground">
            {isFounder
              ? 'Create your first bounty to attract contributors.'
              : 'Check back later for new opportunities.'}
          </p>
          {isFounder && (
            <Button asChild className="mt-4 cursor-pointer">
              <Link href={`/project/${projectId}/bounties/new`}>
                Create Bounty
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {isFounder && (
        <div className="flex justify-end">
          <Button asChild className="cursor-pointer">
            <Link href={`/project/${projectId}/bounties/new`}>
              Create Bounty
            </Link>
          </Button>
        </div>
      )}

      {/* Open Bounties */}
      {openBounties.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">
            Open Bounties ({openBounties.length})
          </h3>
          <div className="grid gap-4">
            {openBounties.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>
        </div>
      )}

      {/* Claimed Bounties */}
      {claimedBounties.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-muted-foreground">
            In Progress ({claimedBounties.length})
          </h3>
          <div className="grid gap-4">
            {claimedBounties.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BountyCard({
  bounty,
}: {
  bounty: BountiesTabProps['bounties'][number]
}) {
  const isOpen = bounty.status === 'OPEN'

  return (
    <Card className={!isOpen ? 'opacity-75' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{bounty.title}</CardTitle>
              {!isOpen && (
                <Badge variant="secondary" className="shrink-0">
                  Claimed
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1 line-clamp-2">
              {bounty.description}
            </CardDescription>
          </div>
          <div className="shrink-0 rounded-lg bg-primary/10 px-3 py-2 text-center text-primary">
            <p className="text-lg font-bold">+{bounty.points}</p>
            <p className="text-xs">points</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4">
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {bounty.tags.map((tag) => (
              <span
                key={tag}
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${tagColors[tag] || 'bg-secondary text-secondary-foreground'}`}
              >
                {tag.toLowerCase()}
              </span>
            ))}
          </div>

          <div className="flex-1" />

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {bounty.claimMode === 'SINGLE' ? (
              <span className="flex items-center gap-1">
                <Users01 className="size-4" />
                Single claim
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Users01 className="size-4" />
                {bounty._count.claims} claimed
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="size-4" />
              {new Date(bounty.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>

          {isOpen && (
            <Button size="sm" className="cursor-pointer">
              Claim Bounty
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
