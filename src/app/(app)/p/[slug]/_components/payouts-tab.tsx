'use client'

import { trpc } from '@/lib/trpc/react'
import {
  ArrowUp,
  BankNote03,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Lock01,
  Plus,
  ShieldTick,
  Target01,
} from '@untitled-ui/icons-react'
import Link from 'next/link'
import { getChartColor } from '@/lib/chart-colors'
import { PayoutPaymentStatus, PayoutVisibility } from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { AppButton } from '@/components/app'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

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

// Payment status config based on Stripe payment tracking
const statusConfig: Record<string, { label: string; color: string }> = {
  [PayoutPaymentStatus.PENDING]: {
    label: 'Awaiting Payment',
    color:
      'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  },
  [PayoutPaymentStatus.PROCESSING]: {
    label: 'Processing',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  [PayoutPaymentStatus.PAID]: {
    label: 'Paid',
    color: 'bg-primary/10 text-primary border-primary/20',
  },
  [PayoutPaymentStatus.FAILED]: {
    label: 'Failed',
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
  [PayoutPaymentStatus.REFUNDED]: {
    label: 'Refunded',
    color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
  },
}

export function PayoutsTab({
  projectId,
  projectSlug,
  isFounder,
  payoutVisibility,
}: PayoutsTabProps) {
  const isPublicMode = payoutVisibility === PayoutVisibility.PUBLIC
  const showPrivateLock =
    payoutVisibility === PayoutVisibility.PRIVATE && isFounder
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
      <Card className="py-12 text-center">
        <div className="mx-auto flex max-w-xs flex-col items-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
            <BankNote03 className="size-6 text-foreground opacity-50" />
          </div>
          <h3 className="text-base font-semibold">No payouts yet</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isFounder
              ? 'Create your first payout to distribute the profit share.'
              : 'Payouts will appear here once the founder distributes the profit share.'}
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
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      {stats && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={BankNote03}
              value={
                isFounder || isPublicMode
                  ? formatCurrency(stats.totalPaidOutCents)
                  : '—'
              }
              label="Total paid out"
              showPrivateLock={showPrivateLock}
            />
            <StatCard
              icon={Calendar}
              value={stats.totalPayouts.toString()}
              label="Payouts"
            />
            <StatCard
              icon={ShieldTick}
              value={`${Math.round(stats.paidRate * 100)}%`}
              label="Paid"
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
            statusConfig[payout.paymentStatus] ||
            statusConfig[PayoutPaymentStatus.PENDING]
          // Use snapshotted capacity from payout time for historical accuracy
          const poolCapacityAtPayout = payout.poolCapacityAtPayout
          const totalPoints = payout.recipients.reduce(
            (sum, r) => sum + r.pointsAtPayout,
            0,
          )
          const poolUtilization = (totalPoints / poolCapacityAtPayout) * 100
          // Stripe transfers auto-verify payment - no need for manual confirmation counts
          const paidCount = payout.recipients.filter((r) => r.paidAt).length
          const unpaidCount = payout.recipients.filter((r) => !r.paidAt).length

          return (
            <Link
              key={payout.id}
              href={routes.project.payoutDetail({
                slug: projectSlug,
                payoutId: payout.id,
              })}
              className="group block rounded-lg border border-border bg-card shadow-md transition-all duration-300 hover:border-primary/75 hover:shadow-lg"
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
                        // Calculate as portion of total to match utilization %
                        const portionPercent =
                          (recipient.pointsAtPayout / poolCapacityAtPayout) *
                          100
                        return (
                          <div
                            key={recipient.id}
                            style={{
                              width: `${portionPercent}%`,
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
                      <div className="flex items-center justify-end gap-1.5 text-sm font-semibold">
                        {showPrivateLock && (
                          <span title="Hidden from others">
                            <Lock01 className="size-3 opacity-50" />
                          </span>
                        )}
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
                        {paidCount > 0 && (
                          <span className="flex items-center gap-0.5 text-primary">
                            <Check className="size-2.5" />
                            {paidCount}
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

      {/* Profit Share Expansion Timeline */}
      {poolStats &&
        poolStats.expansionEvents &&
        poolStats.expansionEvents.length > 0 && (
          <div className="overflow-hidden p-0">
            <div className="border-b border-border py-2.5">
              <h3 className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                <ArrowUp className="size-3" />
                Profit Share Expansion History
              </h3>
            </div>
            <div className="divide-y divide-border">
              {poolStats.expansionEvents.map((event) => (
                <div key={event.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        Profit share expanded: {event.previousCapacity} →{' '}
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
          </div>
        )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  value,
  label,
  showPrivateLock,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: React.ReactNode
  label: string
  showPrivateLock?: boolean
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
          <div className="flex items-center gap-1.5">
            {showPrivateLock && (
              <span title="Hidden from others">
                <Lock01 className="size-3 opacity-50" />
              </span>
            )}
            <p className="text-xs font-bold">{value}</p>
          </div>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  )
}
