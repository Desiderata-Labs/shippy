'use client'

import { trpc } from '@/lib/trpc/react'
import {
  CoinsStacked01,
  ShieldTick,
  Trophy01,
  Users01,
} from '@untitled-ui/icons-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface ContributorsTabProps {
  projectId: string
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function ContributorsTab({ projectId }: ContributorsTabProps) {
  const { data, isLoading, error } = trpc.contributor.getByProject.useQuery({
    projectId,
  })

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Failed to load contributors.
        </p>
      </Card>
    )
  }

  if (!data || data.contributors.length === 0) {
    return (
      <Card className="py-12 text-center">
        <div className="mx-auto flex max-w-xs flex-col items-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
            <Users01 className="size-6 text-foreground opacity-50" />
          </div>
          <h3 className="text-base font-semibold">No contributors yet</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Contributors appear when their submissions are approved.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Users01}
          value={data.contributors.length.toString()}
          label="Contributors"
        />
        <StatCard
          icon={Trophy01}
          value={data.totalPoints.toLocaleString()}
          label="Total points"
        />
        <StatCard
          icon={CoinsStacked01}
          value={formatCurrency(
            data.contributors.reduce(
              (sum, c) => sum + c.lifetimeEarningsCents,
              0,
            ),
          )}
          label="Total paid out"
        />
        <StatCard
          icon={ShieldTick}
          value={`${Math.round((data.contributors.filter((c) => c.lifetimeEarningsCents > 0).length / data.contributors.length) * 100)}%`}
          label="Have earned"
        />
      </div>

      {/* Leaderboard */}
      <div className="p-0">
        {/* Header */}
        <div className="border-b border-border px-4 py-2.5">
          <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Leaderboard
          </h3>
        </div>

        {/* Contributors list */}
        <div className="divide-y divide-border">
          {data.contributors.map((contributor, index) => (
            <ContributorRow
              key={contributor.userId}
              contributor={contributor}
              rank={index + 1}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: string
  label: string
}) {
  return (
    <Card className="p-3">
      <div className="flex items-start gap-2">
        <div
          className={cn('flex size-6 items-center justify-center rounded-sm')}
        >
          <Icon className="-mt-1 size-3.5 text-foreground opacity-50" />
        </div>
        <div>
          <p className="text-xs font-bold">{value}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  )
}

function ContributorRow({
  contributor,
  rank,
}: {
  contributor: {
    userId: string
    userName: string
    userImage: string | null
    points: number
    sharePercent: number
    lifetimeEarningsCents: number
  }
  rank: number
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 last:rounded-b-lg">
      {/* Rank */}
      <div
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-xs font-bold',
        )}
      >
        {rank}
      </div>

      {/* Avatar */}
      <Avatar className="size-7 ring-1 ring-border">
        <AvatarImage src={contributor.userImage ?? undefined} />
        <AvatarFallback className="bg-muted text-xs text-muted-foreground">
          {contributor.userName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Name and points */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{contributor.userName}</p>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>{contributor.points.toLocaleString()} pts</span>
          <span className="text-border">•</span>
          <span>{contributor.sharePercent.toFixed(1)}%</span>
        </div>
      </div>

      {/* Share bar (visual) */}
      <div className="hidden w-16 sm:block">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(contributor.sharePercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Earnings */}
      {contributor.lifetimeEarningsCents > 0 && (
        <div className="rounded-full border border-border px-4 py-1 text-xs font-medium text-foreground">
          {formatCurrency(contributor.lifetimeEarningsCents)}
        </div>
      )}
    </div>
  )
}
