'use client'

import { trpc } from '@/lib/trpc/react'
import {
  Calendar,
  ChevronRight,
  CoinsStacked01,
  Edit05,
  PieChart01,
  Plus,
  Wallet02,
} from '@untitled-ui/icons-react'
import Link from 'next/link'
import { PoolStatus, PoolType } from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { AppButton } from '@/components/app'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface PoolsTabProps {
  projectId: string
  projectSlug: string
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function formatDate(date: Date | string | null): string {
  if (!date) return 'Not set'
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

const poolTypeConfig: Record<
  PoolType,
  { label: string; icon: typeof PieChart01; color: string }
> = {
  [PoolType.PROFIT_SHARE]: {
    label: 'Profit Share',
    icon: PieChart01,
    color: 'text-primary',
  },
  [PoolType.FIXED_BUDGET]: {
    label: 'Fixed Budget',
    icon: Wallet02,
    color: 'text-amber-500',
  },
}

const statusConfig: Record<PoolStatus, { label: string; color: string }> = {
  [PoolStatus.ACTIVE]: {
    label: 'Active',
    color: 'bg-primary/10 text-primary border-primary/20',
  },
  [PoolStatus.EXHAUSTED]: {
    label: 'Exhausted',
    color:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  [PoolStatus.SUNSET]: {
    label: 'Sunset',
    color:
      'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  },
  [PoolStatus.CLOSED]: {
    label: 'Closed',
    color:
      'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20',
  },
}

export function PoolsTab({ projectId, projectSlug }: PoolsTabProps) {
  const { data: pools, isLoading } = trpc.rewardPool.getByProject.useQuery(
    { projectId },
    { enabled: !!projectId },
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    )
  }

  if (!pools || pools.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <CoinsStacked01 className="mx-auto size-10 text-muted-foreground/50" />
        <h3 className="mt-3 text-sm font-medium">No reward pools</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a reward pool to start incentivizing contributors
        </p>
        <AppButton size="sm" className="mt-4" asChild>
          <Link href={routes.project.newPool({ slug: projectSlug })}>
            <Plus className="mr-1.5 size-3.5" />
            Create Pool
          </Link>
        </AppButton>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {pools.length} reward pool{pools.length !== 1 ? 's' : ''}
        </h3>
        <AppButton size="sm" variant="outline" asChild>
          <Link href={routes.project.newPool({ slug: projectSlug })}>
            <Plus className="mr-1.5 size-3.5" />
            Add Pool
          </Link>
        </AppButton>
      </div>

      {/* Pool list */}
      <div className="space-y-3">
        {pools.map((pool) => {
          const typeConfig =
            poolTypeConfig[pool.poolType as PoolType] ??
            poolTypeConfig[PoolType.PROFIT_SHARE]
          const TypeIcon = typeConfig.icon
          const status = statusConfig[pool.status as PoolStatus]

          return (
            <Card key={pool.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                {/* Left side: pool info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <TypeIcon
                      className={cn('size-4 shrink-0', typeConfig.color)}
                    />
                    <h4 className="truncate font-medium">
                      {pool.name || typeConfig.label}
                    </h4>
                    {pool.isDefault && (
                      <Badge variant="secondary" className="text-[10px]">
                        Default
                      </Badge>
                    )}
                    {status && (
                      <Badge
                        variant="outline"
                        className={cn('text-[10px]', status.color)}
                      >
                        {status.label}
                      </Badge>
                    )}
                  </div>

                  {/* Pool-type-specific details */}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {pool.poolType === PoolType.PROFIT_SHARE && (
                      <>
                        <span className="flex items-center gap-1">
                          <PieChart01 className="size-3" />
                          {pool.poolPercentage}% profit share
                        </span>
                        {pool.payoutFrequency && (
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {pool.payoutFrequency === 'MONTHLY'
                              ? 'Monthly'
                              : 'Quarterly'}
                          </span>
                        )}
                        {pool.commitmentEndsAt && (
                          <span className="flex items-center gap-1">
                            Until {formatDate(pool.commitmentEndsAt)}
                          </span>
                        )}
                      </>
                    )}
                    {pool.poolType === PoolType.FIXED_BUDGET && (
                      <>
                        <span className="flex items-center gap-1">
                          <Wallet02 className="size-3" />
                          {formatCurrency(pool.budgetCents ?? 0)} budget
                        </span>
                        <span>
                          {formatCurrency(pool.spentCents ?? 0)} spent
                        </span>
                        <span className="text-primary">
                          {formatCurrency(
                            (pool.budgetCents ?? 0) - (pool.spentCents ?? 0),
                          )}{' '}
                          remaining
                        </span>
                      </>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="mt-3 flex gap-4 text-xs">
                    <span className="text-muted-foreground">
                      <strong className="font-medium text-foreground">
                        {pool._count.bounties}
                      </strong>{' '}
                      bounties
                    </span>
                    <span className="text-muted-foreground">
                      <strong className="font-medium text-foreground">
                        {pool._count.payouts}
                      </strong>{' '}
                      payouts
                    </span>
                    {pool.poolType === PoolType.PROFIT_SHARE && (
                      <span className="text-muted-foreground">
                        <strong className="font-medium text-foreground">
                          {pool.poolCapacity}
                        </strong>{' '}
                        pt capacity
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: edit link */}
                <Link
                  href={routes.project.poolEdit({
                    slug: projectSlug,
                    poolId: pool.id,
                  })}
                  className="flex items-center gap-1 rounded-md p-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Edit05 className="size-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                  <ChevronRight className="size-3" />
                </Link>
              </div>

              {/* Expansion history (for PROFIT_SHARE pools) */}
              {pool.poolType === PoolType.PROFIT_SHARE &&
                pool.expansionEvents &&
                pool.expansionEvents.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <details className="group">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        <span className="ml-1">
                          {pool.expansionEvents.length} capacity expansion
                          {pool.expansionEvents.length !== 1 ? 's' : ''}
                        </span>
                      </summary>
                      <div className="mt-2 space-y-1.5 pl-4">
                        {pool.expansionEvents.map((event) => (
                          <div
                            key={event.id}
                            className="text-xs text-muted-foreground"
                          >
                            <span className="font-medium text-foreground">
                              {event.previousCapacity} &rarr; {event.newCapacity}{' '}
                              pts
                            </span>
                            <span className="ml-2 opacity-70">
                              {new Date(event.createdAt).toLocaleDateString()}
                            </span>
                            {event.reason && (
                              <p className="mt-0.5 text-[11px] opacity-70">
                                {event.reason}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
