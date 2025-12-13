'use client'

import { trpc } from '@/lib/trpc/react'
import {
  ArrowUp,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  CoinsStacked01,
  Plus,
  ShieldTick,
  Target01,
  X,
} from '@untitled-ui/icons-react'
import Link from 'next/link'
import { getChartColor } from '@/lib/chart-colors'
import {
  PayoutRecipientStatus,
  PayoutStatus,
  PayoutVisibility,
} from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { AppButton } from '@/components/app'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { GlassCard } from './glass-card'

interface PayoutsTabProps {
  projectId: string
  projectSlug: string
  isFounder: boolean
  payoutVisibility: string
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function formatPercentage(value: number): string {
  return value.toFixed(1) + '%'
}

const statusConfig: Record<string, { label: string; color: string }> = {
  [PayoutStatus.ANNOUNCED]: {
    label: 'In Progress',
    color:
      'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  },
  [PayoutStatus.SENT]: {
    label: 'All Paid',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  [PayoutStatus.COMPLETED]: {
    label: 'Completed',
    color:
      'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  },
}

export function PayoutsTab({
  projectId,
  projectSlug,
  isFounder,
  payoutVisibility,
}: PayoutsTabProps) {
  const isPublicMode = payoutVisibility === PayoutVisibility.PUBLIC
  // Fetch payouts
  const { data: payouts, isLoading } = trpc.payout.getByProject.useQuery(
    { projectId },
    { enabled: !!projectId },
  )

  // Fetch stats
  const { data: stats } = trpc.payout.getProjectStats.useQuery(
    { projectId },
    { enabled: !!projectId },
  )

  // Fetch pool capacity stats (includes expansion events)
  const { data: poolStats } = trpc.project.getPoolStats.useQuery(
    { projectId },
    { enabled: !!projectId },
  )

  const poolCapacity = poolStats?.poolCapacity ?? 1000

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!payouts || payouts.length === 0) {
    return (
      <GlassCard className="py-12 text-center">
        <div className="mx-auto flex max-w-xs flex-col items-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
            <CoinsStacked01 className="size-6 text-foreground opacity-50" />
          </div>
          <h3 className="text-base font-semibold">No payouts yet</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isFounder
              ? 'Create your first payout to distribute the reward pool.'
              : 'Payouts will appear here once the founder distributes the reward pool.'}
          </p>
          {isFounder && (
            <AppButton asChild className="mt-4" size="sm">
              <Link href={routes.project.newPayout({ slug: projectSlug })}>
                <Plus className="mr-1.5 size-4" />
                Create Payout
              </Link>
            </AppButton>
          )}
        </div>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      {stats && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={CoinsStacked01}
              value={
                isFounder || isPublicMode
                  ? formatCurrency(stats.totalPaidOutCents)
                  : '—'
              }
              label="Total paid out"
            />
            <StatCard
              icon={Calendar}
              value={stats.totalPayouts.toString()}
              label="Payouts"
            />
            <StatCard
              icon={ShieldTick}
              value={`${Math.round(stats.confirmationRate * 100)}%`}
              label="Confirmed"
            />
            {poolStats && (
              <StatCard
                icon={Target01}
                value={
                  <span>
                    {poolStats.earnedPoints}
                    <span className="mx-0.5 text-muted-foreground">/</span>
                    <span className="text-muted-foreground">
                      {poolStats.poolCapacity}
                    </span>
                  </span>
                }
                label="Pts earned / capacity"
              />
            )}
          </div>
        </div>
      )}

      {/* Pool Expansion Timeline */}
      {poolStats &&
        poolStats.expansionEvents &&
        poolStats.expansionEvents.length > 0 && (
          <GlassCard className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2.5">
              <h3 className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                <ArrowUp className="size-3" />
                Pool Expansion History
              </h3>
            </div>
            <div className="divide-y divide-border">
              {poolStats.expansionEvents.map((event) => (
                <div key={event.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        Pool expanded: {event.previousCapacity} →{' '}
                        {event.newCapacity} pts
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {event.reason}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">
                        {parseFloat(event.dilutionPercent.toString()).toFixed(
                          1,
                        )}
                        % dilution
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(event.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

      {/* Header with New Payout button */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Payout History
        </span>
        {isFounder && (
          <AppButton asChild size="sm" className="h-7 text-xs">
            <Link href={routes.project.newPayout({ slug: projectSlug })}>
              <Plus className="mr-1 size-3" />
              New Payout
            </Link>
          </AppButton>
        )}
      </div>

      {/* Payout list - compact cards linking to detail */}
      <div className="space-y-2">
        {payouts.map((payout) => {
          const status =
            statusConfig[payout.status] || statusConfig[PayoutStatus.ANNOUNCED]
          const totalPoints = payout.recipients.reduce(
            (sum, r) => sum + r.pointsAtPayout,
            0,
          )
          const poolUtilization = (totalPoints / poolCapacity) * 100
          const confirmedCount = payout.recipients.filter(
            (r) => r.status === PayoutRecipientStatus.CONFIRMED,
          ).length
          const disputedCount = payout.recipients.filter(
            (r) => r.status === PayoutRecipientStatus.DISPUTED,
          ).length
          const paidCount = payout.recipients.filter((r) => r.paidAt).length
          const unpaidCount = payout.recipients.filter((r) => !r.paidAt).length

          return (
            <Link
              key={payout.id}
              href={routes.project.payoutDetail({
                slug: projectSlug,
                payoutId: payout.id,
              })}
              className="group block rounded-lg border border-border bg-card transition-colors hover:bg-muted/50"
            >
              <div className="p-3">
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Period info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">
                        {payout.periodLabel}
                      </h3>
                      <Badge
                        variant="outline"
                        className={cn('text-[10px]', status.color)}
                      >
                        {status.label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {new Date(payout.periodStart).toLocaleDateString()} –{' '}
                      {new Date(payout.periodEnd).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Center: Distribution bar (hidden on mobile) */}
                  <div className="hidden w-32 sm:block">
                    <div className="flex h-3 overflow-hidden rounded-sm bg-muted/50">
                      {payout.recipients.slice(0, 5).map((recipient, index) => {
                        const capacityPercent =
                          (recipient.pointsAtPayout / poolCapacity) * 100
                        return (
                          <div
                            key={recipient.id}
                            style={{
                              width: `${capacityPercent}%`,
                              backgroundColor: getChartColor(index),
                            }}
                          />
                        )
                      })}
                    </div>
                    <div className="mt-0.5 text-[9px] text-muted-foreground">
                      {formatPercentage(Math.min(poolUtilization, 100))}{' '}
                      utilized
                    </div>
                  </div>

                  {/* Right: Amount and status counts */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {isFounder || isPublicMode
                          ? formatCurrency(payout.poolAmountCents)
                          : `${payout.recipients.length} recipient${payout.recipients.length !== 1 ? 's' : ''}`}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
                        {unpaidCount > 0 && (
                          <span className="flex items-center gap-0.5 text-yellow-600 dark:text-yellow-400">
                            <Clock className="size-2.5" />
                            {unpaidCount}
                          </span>
                        )}
                        {paidCount > 0 && confirmedCount < paidCount && (
                          <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
                            <Check className="size-2.5" />
                            {paidCount - confirmedCount}
                          </span>
                        )}
                        {confirmedCount > 0 && (
                          <span className="flex items-center gap-0.5 text-foreground opacity-50">
                            <Check className="size-2.5" />
                            {confirmedCount}
                          </span>
                        )}
                        {disputedCount > 0 && (
                          <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
                            <X className="size-2.5" />
                            {disputedCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
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
  value: React.ReactNode
  label: string
}) {
  return (
    <GlassCard className="p-3">
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
    </GlassCard>
  )
}
