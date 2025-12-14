'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  BankNote03,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  Lock01,
  X,
} from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { redirect } from 'next/navigation'
import { getChartColor } from '@/lib/chart-colors'
import {
  PayoutRecipientStatus,
  PayoutStatus,
  PayoutVisibility,
} from '@/lib/db/types'
import { ProjectTab, routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { AppButton } from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ErrorState } from '@/components/ui/error-state'
import { NotFoundState } from '@/components/ui/not-found-state'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

enum RecipientFilter {
  All = 'all',
  Unpaid = 'unpaid',
  Paid = 'paid',
  Confirmed = 'confirmed',
  Disputed = 'disputed',
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
    color: 'bg-primary/10 text-primary border-primary/20',
  },
  [PayoutStatus.COMPLETED]: {
    label: 'Completed',
    color: 'bg-primary/10 text-primary border-primary/20',
  },
}

// Get display status for a recipient based on paidAt and status
function getRecipientDisplayStatus(recipient: {
  paidAt: Date | null
  status: string
}): { label: string; color: string; icon: typeof Check } {
  // If confirmed by contributor
  if (recipient.status === PayoutRecipientStatus.CONFIRMED) {
    return {
      label: 'Confirmed',
      color: 'text-primary',
      icon: Check,
    }
  }
  // If disputed by contributor
  if (recipient.status === PayoutRecipientStatus.DISPUTED) {
    return {
      label: 'Disputed',
      color: 'text-red-600 dark:text-red-400',
      icon: X,
    }
  }
  // If paid but not confirmed yet
  if (recipient.paidAt) {
    return {
      label: 'Awaiting confirmation',
      color: 'text-primary',
      icon: Clock,
    }
  }
  // Not paid yet
  return {
    label: 'Not paid',
    color: 'text-yellow-600 dark:text-yellow-400',
    icon: Clock,
  }
}

export function PayoutDetailContent() {
  const params = useParams<{ slug: string; payoutId: string }>()
  const { data: session, isPending: sessionLoading } = useSession()
  const [markingAllPaid, setMarkingAllPaid] = useState(false)
  const [markingRecipientId, setMarkingRecipientId] = useState<string | null>(
    null,
  )
  const [confirmingReceipt, setConfirmingReceipt] = useState(false)
  const [filter, setFilter] = useState<RecipientFilter>(RecipientFilter.All)
  const [confirmPayRecipient, setConfirmPayRecipient] = useState<{
    id: string
    name: string
    amount: number
  } | null>(null)

  // Fetch payout data
  const {
    data: payout,
    isLoading: payoutLoading,
    isError: payoutError,
    error: payoutErrorData,
    refetch: refetchPayout,
  } = trpc.payout.getById.useQuery(
    { payoutId: params.payoutId },
    { enabled: !!params.payoutId, retry: false },
  )

  const utils = trpc.useUtils()

  const markAllPaid = trpc.payout.markAllPaid.useMutation({
    onSuccess: () => {
      toast.success('All recipients marked as paid')
      utils.payout.getById.invalidate({ payoutId: params.payoutId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const markRecipientPaid = trpc.payout.markRecipientPaid.useMutation({
    onSuccess: () => {
      toast.success('Marked as paid')
      utils.payout.getById.invalidate({ payoutId: params.payoutId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const confirmReceipt = trpc.payout.confirmReceipt.useMutation({
    onSuccess: (_, variables) => {
      toast.success(
        variables.confirmed ? 'Receipt confirmed!' : 'Dispute submitted',
      )
      utils.payout.getById.invalidate({ payoutId: params.payoutId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Loading state
  if (sessionLoading || payoutLoading) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          <div className="mb-6">
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto_340px]">
            <Skeleton className="h-96" />
            <Skeleton className="hidden h-full w-px lg:block" />
            <Skeleton className="h-80" />
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
  if (payoutError) {
    const isNotFound = payoutErrorData?.data?.code === 'NOT_FOUND'
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          {isNotFound ? (
            <NotFoundState
              resourceType="payout"
              backHref={routes.project.detail({
                slug: params.slug,
                tab: ProjectTab.PAYOUTS,
              })}
              backLabel="Back to Payouts"
            />
          ) : (
            <ErrorState
              message={payoutErrorData?.message}
              errorId={payoutErrorData?.data?.errorId}
              backHref={routes.project.detail({
                slug: params.slug,
                tab: ProjectTab.PAYOUTS,
              })}
              backLabel="Back to Payouts"
              onRetry={() => refetchPayout()}
            />
          )}
        </div>
      </AppBackground>
    )
  }

  if (!payout) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          <NotFoundState
            resourceType="payout"
            backHref={routes.project.detail({
              slug: params.slug,
              tab: ProjectTab.PAYOUTS,
            })}
            backLabel="Back to Payouts"
          />
        </div>
      </AppBackground>
    )
  }

  const isFounder = payout.project.founderId === session.user.id
  const isPublicMode =
    payout.project.payoutVisibility === PayoutVisibility.PUBLIC
  const showPrivateLock =
    payout.project.payoutVisibility === PayoutVisibility.PRIVATE && isFounder

  // Check if current user is a recipient
  const myRecipient = payout.recipients.find(
    (r) => r.user.id === session.user.id,
  )
  const canConfirmReceipt =
    myRecipient &&
    myRecipient.paidAt &&
    myRecipient.status === PayoutRecipientStatus.PENDING

  // Visibility helper - determines if an amount should be shown for a given recipient
  const canSeeAmount = (recipientUserId: string) => {
    // Founder can see all amounts
    if (isFounder) return true
    // Public mode shows all amounts
    if (isPublicMode) return true
    // In private mode, users can only see their own amounts
    return recipientUserId === session.user.id
  }

  // Can the current user see any financial details at all?
  const canSeeFinancials = isFounder || isPublicMode || !!myRecipient

  const status =
    statusConfig[payout.status] || statusConfig[PayoutStatus.ANNOUNCED]
  // Use snapshotted values from payout time for historical accuracy
  const poolCapacityAtPayout = payout.poolCapacityAtPayout
  const totalPoints = payout.recipients.reduce(
    (sum, r) => sum + r.pointsAtPayout,
    0,
  )
  const poolUtilization = (totalPoints / poolCapacityAtPayout) * 100

  // Group recipients by status
  const unpaidRecipients = payout.recipients.filter((r) => !r.paidAt)
  const paidRecipients = payout.recipients.filter(
    (r) =>
      r.paidAt &&
      r.status !== PayoutRecipientStatus.CONFIRMED &&
      r.status !== PayoutRecipientStatus.DISPUTED,
  )
  const confirmedRecipients = payout.recipients.filter(
    (r) => r.status === PayoutRecipientStatus.CONFIRMED,
  )
  const disputedRecipients = payout.recipients.filter(
    (r) => r.status === PayoutRecipientStatus.DISPUTED,
  )

  // Get filtered recipients
  const filteredRecipients = (() => {
    switch (filter) {
      case RecipientFilter.Unpaid:
        return unpaidRecipients
      case RecipientFilter.Paid:
        return paidRecipients
      case RecipientFilter.Confirmed:
        return confirmedRecipients
      case RecipientFilter.Disputed:
        return disputedRecipients
      default:
        return payout.recipients
    }
  })()

  // Counts for display
  const unpaidCount = unpaidRecipients.length
  const paidCount = paidRecipients.length
  const confirmedCount = confirmedRecipients.length
  const disputedCount = disputedRecipients.length

  const handleMarkAllPaid = async () => {
    setMarkingAllPaid(true)
    try {
      await markAllPaid.mutateAsync({ payoutId: payout.id })
    } finally {
      setMarkingAllPaid(false)
    }
  }

  const handleMarkRecipientPaid = async (recipientId: string) => {
    setMarkingRecipientId(recipientId)
    try {
      await markRecipientPaid.mutateAsync({ recipientId })
    } finally {
      setMarkingRecipientId(null)
    }
  }

  const handleConfirmReceipt = async (confirmed: boolean) => {
    setConfirmingReceipt(true)
    try {
      await confirmReceipt.mutateAsync({
        payoutId: payout.id,
        confirmed,
      })
    } finally {
      setConfirmingReceipt(false)
    }
  }

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl p-6">
        {/* Breadcrumb navigation */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link
            href={routes.project.detail({ slug: params.slug })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {payout.project.name}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <Link
            href={routes.project.detail({
              slug: params.slug,
              tab: ProjectTab.PAYOUTS,
            })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Payouts
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground">{payout.periodLabel}</span>
        </div>

        {/* Main layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_auto_340px]">
          {/* Left side - Payout details */}
          <div className="space-y-6">
            {/* Header card */}
            <div className="rounded-lg border border-border bg-card">
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      Payout Period
                    </div>
                    <h1 className="text-2xl font-bold">{payout.periodLabel}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(payout.periodStart).toLocaleDateString()} –{' '}
                      {new Date(payout.periodEnd).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn('text-xs', status.color)}
                  >
                    {status.label}
                  </Badge>
                </div>
              </div>

              {canSeeFinancials && (
                <>
                  <Separator />

                  <div className="p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <BankNote03 className="size-3" />
                      Reported Profit
                    </div>
                    <div className="text-3xl font-bold">
                      {formatCurrency(payout.reportedProfitCents)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pool: {formatCurrency(payout.poolAmountCents)} (
                      {payout.project.rewardPool?.poolPercentage ?? 10}% of
                      profit)
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Summary stats */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="text-xs text-muted-foreground">Pool Amount</div>
                <div className="text-lg font-semibold">
                  {canSeeFinancials ? (
                    formatCurrency(payout.poolAmountCents)
                  ) : (
                    <span className="text-muted-foreground">Hidden</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {payout.project.rewardPool?.poolPercentage ?? 10}% of profit
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="text-xs text-muted-foreground">
                  Pool Utilization
                </div>
                <div className="text-lg font-semibold">
                  {formatPercentage(Math.min(poolUtilization, 100))}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {totalPoints} / {poolCapacityAtPayout} pts
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="text-xs text-muted-foreground">Distributed</div>
                <div className="text-lg font-semibold text-primary">
                  {canSeeFinancials ? (
                    formatCurrency(
                      payout.recipients.reduce(
                        (sum, r) => sum + r.amountCents,
                        0,
                      ),
                    )
                  ) : (
                    <span className="text-muted-foreground">Hidden</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  to {payout.recipients.length} contributor
                  {payout.recipients.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Sent note (legacy) */}
            {payout.sentNote && (
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                <p className="text-sm text-primary">
                  <span className="font-medium">Payment note:</span>{' '}
                  {payout.sentNote}
                </p>
                {payout.sentAt && (
                  <p className="mt-1 text-xs text-primary/70">
                    Marked all paid on{' '}
                    {new Date(payout.sentAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            {/* Contributor: Confirm receipt (when they've been marked as paid) */}
            {canConfirmReceipt && myRecipient && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="mb-3">
                  <p className="text-sm font-medium">Confirm Your Payout</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You&apos;ve been marked as paid{' '}
                    <span className="font-semibold text-primary">
                      {formatCurrency(myRecipient.amountCents)}
                    </span>
                    . Please confirm you received it.
                  </p>
                  {myRecipient.paidNote && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium">Payment reference:</span>{' '}
                      {myRecipient.paidNote}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <AppButton
                    size="sm"
                    onClick={() => handleConfirmReceipt(true)}
                    disabled={confirmingReceipt}
                    className="flex-1"
                  >
                    {confirmingReceipt ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 size-4" />
                    )}
                    Yes, I Received It
                  </AppButton>
                  <AppButton
                    size="sm"
                    variant="outline"
                    onClick={() => handleConfirmReceipt(false)}
                    disabled={confirmingReceipt}
                    className="text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    <X className="mr-2 size-4" />
                    Not Received
                  </AppButton>
                </div>
              </div>
            )}

            {/* Contributor: Already confirmed message */}
            {myRecipient &&
              myRecipient.status === PayoutRecipientStatus.CONFIRMED && (
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-primary" />
                    <p className="text-sm font-medium text-primary">
                      You confirmed receiving{' '}
                      {formatCurrency(myRecipient.amountCents)}
                    </p>
                  </div>
                  {myRecipient.confirmedAt && (
                    <p className="mt-1 text-xs text-primary/70">
                      Confirmed on{' '}
                      {new Date(myRecipient.confirmedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

            {/* Contributor: Disputed message with option to resolve */}
            {myRecipient &&
              myRecipient.status === PayoutRecipientStatus.DISPUTED && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                  <div className="flex items-center gap-2">
                    <X className="size-4 text-red-600 dark:text-red-400" />
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                      You disputed this payout
                    </p>
                  </div>
                  {myRecipient.disputeReason && (
                    <p className="mt-1 text-xs text-red-700/70 dark:text-red-400/70">
                      Reason: {myRecipient.disputeReason}
                    </p>
                  )}
                  <div className="mt-3 border-t border-red-500/20 pt-3">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Received the payment after all? You can mark it as
                      received.
                    </p>
                    <AppButton
                      size="sm"
                      onClick={() => handleConfirmReceipt(true)}
                      disabled={confirmingReceipt}
                    >
                      {confirmingReceipt ? (
                        <Loader2 className="mr-2 size-3 animate-spin" />
                      ) : (
                        <Check className="mr-2 size-3" />
                      )}
                      Mark as Received
                    </AppButton>
                  </div>
                </div>
              )}

            {/* Contributor: Awaiting payment message */}
            {myRecipient && !myRecipient.paidAt && (
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-yellow-600 dark:text-yellow-400" />
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    Awaiting payment: {formatCurrency(myRecipient.amountCents)}
                  </p>
                </div>
                <p className="mt-1 text-xs text-yellow-700/70 dark:text-yellow-400/70">
                  The founder hasn&apos;t marked your payout as paid yet.
                </p>
              </div>
            )}

            {/* Private visibility notice for founder */}
            {showPrivateLock && (
              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
                <Lock01 className="mt-0.5 size-4 shrink-0 opacity-50" />
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Private payouts enabled
                  </span>
                  <p className="mt-0.5">
                    Financial details on this page are only visible to you and
                    contributors.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Vertical separator */}
          <Separator orientation="vertical" className="hidden lg:block" />

          {/* Right side - Distribution */}
          <div className="space-y-4">
            {/* Header with Mark All button */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                {payout.periodLabel} Split
              </span>
              {isFounder && unpaidCount > 0 && (
                <AppButton
                  size="sm"
                  variant="outline"
                  onClick={handleMarkAllPaid}
                  disabled={markingAllPaid}
                  className="h-7 text-xs"
                >
                  {markingAllPaid ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-1 size-3" />
                  )}
                  Mark All Paid
                </AppButton>
              )}
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-1">
              <FilterButton
                active={filter === RecipientFilter.All}
                onClick={() => setFilter(RecipientFilter.All)}
              >
                All ({payout.recipients.length})
              </FilterButton>
              <FilterButton
                active={filter === RecipientFilter.Unpaid}
                onClick={() => setFilter(RecipientFilter.Unpaid)}
                disabled={unpaidCount === 0}
              >
                <span className="mr-1.5 size-2 rounded-full bg-yellow-500" />
                Unpaid ({unpaidCount})
              </FilterButton>
              <FilterButton
                active={filter === RecipientFilter.Paid}
                onClick={() => setFilter(RecipientFilter.Paid)}
                disabled={paidCount === 0}
              >
                <span className="mr-1.5 size-2 rounded-full bg-primary" />
                Paid ({paidCount})
              </FilterButton>
              <FilterButton
                active={filter === RecipientFilter.Confirmed}
                onClick={() => setFilter(RecipientFilter.Confirmed)}
                disabled={confirmedCount === 0}
              >
                <span className="mr-1.5 size-2 rounded-full bg-primary" />
                Confirmed ({confirmedCount})
              </FilterButton>
              {disputedCount > 0 && (
                <FilterButton
                  active={filter === RecipientFilter.Disputed}
                  onClick={() => setFilter(RecipientFilter.Disputed)}
                >
                  <span className="mr-1.5 size-2 rounded-full bg-red-500" />
                  Disputed ({disputedCount})
                </FilterButton>
              )}
            </div>

            {/* Distribution bar - shows money split including platform fee */}
            <div className="flex h-8 overflow-hidden rounded-lg bg-muted/50">
              {payout.recipients.map((recipient, index) => {
                // Show as % of total pool amount (including platform fee)
                const amountPercent =
                  (recipient.amountCents / payout.poolAmountCents) * 100
                const canSeeThisAmount = canSeeAmount(recipient.user.id)
                return (
                  <motion.div
                    key={recipient.id}
                    initial={{ width: 0 }}
                    animate={{ width: `${amountPercent}%` }}
                    transition={{
                      duration: 0.6,
                      delay: index * 0.08,
                      ease: [0.34, 1.56, 0.64, 1],
                    }}
                    className="h-full hover:opacity-80"
                    style={{ backgroundColor: getChartColor(index) }}
                    title={
                      canSeeThisAmount
                        ? `${recipient.user.name}: ${formatCurrency(recipient.amountCents)} (${formatPercentage(amountPercent)})`
                        : `${recipient.user.name}: ${formatPercentage(amountPercent)}`
                    }
                  />
                )
              })}
              {/* Shippy platform fee segment */}
              {payout.platformFeeCents > 0 && canSeeFinancials && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(payout.platformFeeCents / payout.poolAmountCents) * 100}%`,
                  }}
                  transition={{
                    duration: 0.6,
                    delay: payout.recipients.length * 0.08,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                  className="h-full hover:opacity-80"
                  style={{
                    backgroundColor: getChartColor(payout.recipients.length),
                  }}
                  title={`Shippy: ${formatCurrency(payout.platformFeeCents)} (${formatPercentage((payout.platformFeeCents / payout.poolAmountCents) * 100)})`}
                />
              )}
              {/* Undistributed portion */}
              {(() => {
                const distributedCents =
                  payout.recipients.reduce((sum, r) => sum + r.amountCents, 0) +
                  payout.platformFeeCents
                const undistributedPercent =
                  ((payout.poolAmountCents - distributedCents) /
                    payout.poolAmountCents) *
                  100
                return undistributedPercent > 0 ? (
                  <div className="flex-1" />
                ) : null
              })()}
            </div>

            {/* Recipients list */}
            <div className="space-y-2">
              {filteredRecipients.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No recipients match this filter
                </div>
              ) : (
                filteredRecipients.map((recipient) => {
                  // Get original index for consistent colors
                  const index = payout.recipients.findIndex(
                    (r) => r.id === recipient.id,
                  )
                  const displayStatus = getRecipientDisplayStatus(recipient)
                  const StatusIcon = displayStatus.icon
                  const isPaid = !!recipient.paidAt
                  const isMarking = markingRecipientId === recipient.id

                  return (
                    <div
                      key={recipient.id}
                      className="rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: getChartColor(index) }}
                          />
                          <Avatar className="size-6">
                            <AvatarImage
                              src={recipient.user.image ?? undefined}
                            />
                            <AvatarFallback className="text-[10px]">
                              {recipient.user.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="text-sm font-medium">
                              {recipient.user.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <StatusIcon
                                className={cn('size-3', displayStatus.color)}
                              />
                              <span
                                className={cn(
                                  'text-[10px]',
                                  displayStatus.color,
                                )}
                              >
                                {displayStatus.label}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            {canSeeAmount(recipient.user.id) ? (
                              <>
                                <div className="text-sm font-semibold text-primary">
                                  {formatCurrency(recipient.amountCents)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {recipient.pointsAtPayout} pts (
                                  {formatPercentage(
                                    (recipient.amountCents /
                                      payout.poolAmountCents) *
                                      100,
                                  )}
                                  )
                                </div>
                              </>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                {recipient.pointsAtPayout} pts
                              </div>
                            )}
                          </div>
                          {/* Individual pay button for founder */}
                          {isFounder && !isPaid && (
                            <AppButton
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setConfirmPayRecipient({
                                  id: recipient.id,
                                  name: recipient.user.name,
                                  amount: recipient.amountCents,
                                })
                              }
                              disabled={isMarking}
                              className="size-7 p-0"
                              title="Mark as paid"
                            >
                              {isMarking ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="size-3.5" />
                              )}
                            </AppButton>
                          )}
                          {/* Show check if paid */}
                          {isPaid &&
                            recipient.status !==
                              PayoutRecipientStatus.CONFIRMED && (
                              <div className="flex size-7 items-center justify-center">
                                <CheckCircle className="size-3.5 text-primary" />
                              </div>
                            )}
                          {recipient.status ===
                            PayoutRecipientStatus.CONFIRMED && (
                            <div className="flex size-7 items-center justify-center">
                              <Check className="size-3.5 text-primary" />
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Show paid note if exists */}
                      {recipient.paidNote && (
                        <div className="mt-2 rounded-sm bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground">
                          {recipient.paidNote}
                        </div>
                      )}
                    </div>
                  )
                })
              )}

              {/* Shippy Platform Fee - only show to those who can see financials */}
              {payout.platformFeeCents > 0 &&
                canSeeFinancials &&
                (() => {
                  const shippyColor = getChartColor(payout.recipients.length)
                  return (
                    <div
                      className="flex items-center justify-between rounded-lg border px-3 py-2.5"
                      style={{
                        borderColor: shippyColor,
                        backgroundColor: shippyColor.replace(')', ' / 0.1)'),
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/logo-mark.svg"
                          alt="Shippy"
                          className="size-6"
                        />
                        <div>
                          <span className="text-sm font-medium">Shippy</span>
                          <p className="text-[10px] text-muted-foreground">
                            Platform fee (
                            {payout.project.rewardPool?.platformFeePercentage ??
                              10}
                            % of pool)
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-muted-foreground">
                          {formatCurrency(payout.platformFeeCents)}
                        </div>
                        <a
                          href="mailto:pay@shippy.sh"
                          className="text-[10px] text-muted-foreground underline"
                        >
                          pay@shippy.sh
                        </a>
                      </div>
                    </div>
                  )
                })()}
            </div>

            {/* Total - only show if user can see financials */}
            {canSeeFinancials && (
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-medium">Total</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(
                    payout.recipients.reduce(
                      (sum, r) => sum + r.amountCents,
                      0,
                    ) + payout.platformFeeCents,
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm mark as paid modal */}
      <ConfirmModal
        open={!!confirmPayRecipient}
        onClose={() => setConfirmPayRecipient(null)}
        onConfirm={async () => {
          if (confirmPayRecipient) {
            await handleMarkRecipientPaid(confirmPayRecipient.id)
            setConfirmPayRecipient(null)
          }
        }}
        title="Mark as Paid"
        description={
          confirmPayRecipient
            ? `Confirm that you've sent ${formatCurrency(confirmPayRecipient.amount)} to ${confirmPayRecipient.name}?`
            : ''
        }
        confirmText="Yes, I've Paid"
        cancelText="Cancel"
        variant="default"
        isLoading={!!markingRecipientId}
      />
    </AppBackground>
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
