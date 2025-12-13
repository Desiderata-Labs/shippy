'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  Check,
  ChevronRight,
  Clock,
  CoinsStacked01,
  Plus,
  X,
} from '@untitled-ui/icons-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { redirect } from 'next/navigation'
import { getChartColor } from '@/lib/chart-colors'
import { PayoutRecipientStatus, PayoutStatus } from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { AppButton } from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/ui/error-state'
import { NotFoundState } from '@/components/ui/not-found-state'
import { Skeleton } from '@/components/ui/skeleton'

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
    label: 'Pending',
    color:
      'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  },
  [PayoutStatus.SENT]: {
    label: 'Paid',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  [PayoutStatus.COMPLETED]: {
    label: 'Completed',
    color:
      'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  },
}

export function PayoutsContent() {
  const params = useParams<{ slug: string }>()
  const { data: session, isPending: sessionLoading } = useSession()

  // Fetch project data
  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
    error: projectErrorData,
    refetch: refetchProject,
  } = trpc.project.getBySlug.useQuery(
    { slug: params.slug },
    { enabled: !!params.slug, retry: false },
  )

  // Fetch payouts
  const { data: payouts, isLoading: payoutsLoading } =
    trpc.payout.getByProject.useQuery(
      { projectId: project?.id ?? '' },
      { enabled: !!project?.id },
    )

  // Loading states
  if (sessionLoading || projectLoading) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-6">
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </AppBackground>
    )
  }

  // Auth check
  if (!session) {
    redirect(routes.auth.signIn())
  }

  // Handle errors
  if (projectError) {
    const isNotFoundOrForbidden =
      projectErrorData?.data?.code === 'NOT_FOUND' ||
      projectErrorData?.data?.code === 'FORBIDDEN' ||
      projectErrorData?.data?.code === 'BAD_REQUEST'
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl px-4 py-8">
          {isNotFoundOrForbidden ? (
            <NotFoundState
              resourceType="project"
              backHref={routes.dashboard.root()}
              backLabel="Back to Dashboard"
            />
          ) : (
            <ErrorState
              message={projectErrorData?.message}
              errorId={projectErrorData?.data?.errorId}
              backHref={routes.dashboard.root()}
              backLabel="Back to Dashboard"
              onRetry={() => refetchProject()}
            />
          )}
        </div>
      </AppBackground>
    )
  }

  // Project not found or user is not the founder
  if (!project || project.founderId !== session.user.id) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl px-4 py-8">
          <NotFoundState
            resourceType="project"
            backHref={routes.dashboard.root()}
            backLabel="Back to Dashboard"
          />
        </div>
      </AppBackground>
    )
  }

  const poolCapacity = project.rewardPool?.poolCapacity ?? 1000

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Breadcrumb navigation */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link
            href={routes.project.detail({ slug: params.slug })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {project.name}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground">Payouts</span>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Payouts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage reward pool distributions
            </p>
          </div>
          <AppButton asChild size="sm">
            <Link href={routes.project.newPayout({ slug: params.slug })}>
              <Plus className="mr-1.5 size-4" />
              New Payout
            </Link>
          </AppButton>
        </div>

        {payoutsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : !payouts || payouts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-12 text-center">
            <div className="mx-auto flex max-w-xs flex-col items-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <CoinsStacked01 className="size-6 text-primary" />
              </div>
              <h3 className="text-base font-semibold">No payouts yet</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Create your first payout to distribute the reward pool.
              </p>
              <AppButton asChild className="mt-4" size="sm">
                <Link href={routes.project.newPayout({ slug: params.slug })}>
                  <Plus className="mr-1.5 size-4" />
                  Create Payout
                </Link>
              </AppButton>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {payouts.map((payout) => {
              const status =
                statusConfig[payout.status] ||
                statusConfig[PayoutStatus.ANNOUNCED]
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

              return (
                <Link
                  key={payout.id}
                  href={routes.project.payoutDetail({
                    slug: params.slug,
                    payoutId: payout.id,
                  })}
                  className="group block rounded-lg border border-border bg-card transition-colors hover:bg-muted/50"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: Period info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            {payout.periodLabel}
                          </h3>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px]', status.color)}
                          >
                            {status.label}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(payout.periodStart).toLocaleDateString()} –{' '}
                          {new Date(payout.periodEnd).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Center: Distribution bar (hidden on mobile) */}
                      <div className="hidden w-48 sm:block">
                        <div className="flex h-4 overflow-hidden rounded-sm bg-muted/50">
                          {payout.recipients
                            .slice(0, 5)
                            .map((recipient, index) => {
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
                        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{payout.recipients.length} recipients</span>
                          <span>
                            {formatPercentage(Math.min(poolUtilization, 100))}{' '}
                            utilized
                          </span>
                        </div>
                      </div>

                      {/* Right: Amount and confirmations */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold text-primary">
                            {formatCurrency(payout.poolAmountCents)}
                          </div>
                          <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                              <Check className="size-3" />
                              {confirmedCount}
                            </span>
                            {disputedCount > 0 && (
                              <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
                                <X className="size-3" />
                                {disputedCount}
                              </span>
                            )}
                            {payout.recipients.length -
                              confirmedCount -
                              disputedCount >
                              0 && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="size-3" />
                                {payout.recipients.length -
                                  confirmedCount -
                                  disputedCount}
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
        )}
      </div>
    </AppBackground>
  )
}
