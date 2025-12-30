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
} from '@untitled-ui/icons-react'
import { CreditCard02 } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { redirect } from 'next/navigation'
import { getChartColor } from '@/lib/chart-colors'
import { PayoutPaymentStatus, PayoutVisibility } from '@/lib/db/types'
import { ProjectTab, routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { AppButton } from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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

// Get display status for a recipient based on paidAt (Stripe transfers auto-verify payment)
function getRecipientDisplayStatus(recipient: { paidAt: Date | null }): {
  label: string
  color: string
  icon: typeof Check
} {
  // Paid via Stripe transfer
  if (recipient.paidAt) {
    return {
      label: 'Paid',
      color: 'text-primary',
      icon: Check,
    }
  }
  // Not paid yet
  return {
    label: 'Awaiting payment',
    color: 'text-yellow-600 dark:text-yellow-400',
    icon: Clock,
  }
}

export function PayoutDetailContent() {
  const params = useParams<{ slug: string; payoutId: string }>()
  const { data: session, isPending: sessionLoading } = useSession()
  const [filter, setFilter] = useState<RecipientFilter>(RecipientFilter.All)

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

  // Stripe checkout mutation - redirects to Stripe's hosted Checkout
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState(false)
  const createPayoutCheckout = trpc.stripe.createPayoutCheckout.useMutation({
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      window.location.href = data.checkoutUrl
    },
    onError: (error) => {
      setIsRedirectingToStripe(false)
      toast.error(error.message)
    },
  })

  const handlePayWithStripe = async () => {
    setIsRedirectingToStripe(true)
    await createPayoutCheckout.mutateAsync({
      payoutId: params.payoutId,
      projectSlug: params.slug,
    })
  }

  // Get user's Stripe Connect account status (for contributors)
  const { data: stripeAccountStatus } = trpc.stripe.getAccountStatus.useQuery(
    undefined,
    { enabled: !!session },
  )

  // Retry transfer mutation for contributors
  const [retryingTransfer, setRetryingTransfer] = useState(false)
  const retryTransfer = trpc.stripe.retryRecipientTransfer.useMutation({
    onSuccess: () => {
      toast.success('Transfer initiated successfully!')
      utils.payout.getById.invalidate({ payoutId: params.payoutId })
      setRetryingTransfer(false)
    },
    onError: (error) => {
      toast.error(error.message)
      setRetryingTransfer(false)
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
  const username = (session?.user as { username?: string })?.username
  const isPublicMode =
    payout.project.payoutVisibility === PayoutVisibility.PUBLIC
  const showPrivateLock =
    payout.project.payoutVisibility === PayoutVisibility.PRIVATE && isFounder

  // Check if current user is a recipient
  const myRecipient = payout.recipients.find(
    (r) => r.user.id === session.user.id,
  )

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
    statusConfig[payout.paymentStatus] ||
    statusConfig[PayoutPaymentStatus.PENDING]
  // Use snapshotted values from payout time for historical accuracy
  const poolCapacityAtPayout = payout.poolCapacityAtPayout
  const totalPoints = payout.recipients.reduce(
    (sum, r) => sum + r.pointsAtPayout,
    0,
  )
  const poolUtilization = (totalPoints / poolCapacityAtPayout) * 100

  // Group recipients by paid status (Stripe transfers auto-verify payment)
  const unpaidRecipients = payout.recipients.filter((r) => !r.paidAt)
  const paidRecipients = payout.recipients.filter((r) => r.paidAt)

  // Get filtered recipients
  const filteredRecipients = (() => {
    switch (filter) {
      case RecipientFilter.Unpaid:
        return unpaidRecipients
      case RecipientFilter.Paid:
        return paidRecipients
      default:
        return payout.recipients
    }
  })()

  // Counts for display
  const unpaidCount = unpaidRecipients.length
  const paidCount = paidRecipients.length

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
                      Profit share: {formatCurrency(payout.poolAmountCents)} (
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
                <div className="text-xs text-muted-foreground">
                  Profit Share Amount
                </div>
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
                  Profit Share Utilization
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

            {/* Contributor: Awaiting payment message */}
            {myRecipient && !myRecipient.paidAt && (
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-yellow-600 dark:text-yellow-400" />
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    Awaiting payment: {formatCurrency(myRecipient.amountCents)}
                  </p>
                </div>
                {payout.paymentStatus === PayoutPaymentStatus.PAID ? (
                  // Founder has paid - show message based on user's Stripe Connect status
                  stripeAccountStatus?.hasAccount &&
                  stripeAccountStatus?.status === 'ACTIVE' ? (
                    // User has active Stripe Connect
                    myRecipient.amountCents < 50 ? (
                      // Amount below Stripe minimum - will be combined with future payouts
                      <p className="mt-1 text-xs text-yellow-700/70 dark:text-yellow-400/70">
                        Your payout amount (
                        {formatCurrency(myRecipient.amountCents)}) is below
                        Stripe&apos;s $0.50 minimum. It will be combined with
                        your next payout from this project.
                      </p>
                    ) : (
                      // Show get paid button
                      <div className="mt-3">
                        <p className="mb-2 text-xs text-yellow-700/70 dark:text-yellow-400/70">
                          The founder has paid and your Stripe account is ready.
                        </p>
                        <AppButton
                          size="sm"
                          onClick={() => {
                            setRetryingTransfer(true)
                            retryTransfer.mutate({
                              recipientId: myRecipient.id,
                            })
                          }}
                          disabled={retryingTransfer}
                          className="cursor-pointer"
                        >
                          {retryingTransfer ? (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                          ) : (
                            <BankNote03 className="mr-2 size-4" />
                          )}
                          Get Paid
                        </AppButton>
                      </div>
                    )
                  ) : stripeAccountStatus?.hasAccount ? (
                    // User has Stripe Connect but not active
                    <p className="mt-1 text-xs text-yellow-700/70 dark:text-yellow-400/70">
                      The founder has paid.{' '}
                      <Link
                        href={routes.user.settings({
                          username: username!,
                        })}
                        className="font-medium text-yellow-700 underline hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300"
                      >
                        Complete your Stripe Connect setup
                      </Link>{' '}
                      to receive your payout.
                    </p>
                  ) : (
                    // User doesn't have Stripe Connect at all
                    <p className="mt-1 text-xs text-yellow-700/70 dark:text-yellow-400/70">
                      The founder has paid.{' '}
                      <Link
                        href={routes.user.settings({
                          username: username!,
                        })}
                        className="font-medium text-yellow-700 underline hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300"
                      >
                        Set up Stripe Connect
                      </Link>{' '}
                      to receive your payout.
                    </p>
                  )
                ) : payout.paymentStatus === PayoutPaymentStatus.PROCESSING ? (
                  // Payment is processing (likely ACH settling)
                  <p className="mt-1 text-xs text-yellow-700/70 dark:text-yellow-400/70">
                    Payment is processing. Bank transfers (ACH) typically take
                    3-5 business days to settle.
                  </p>
                ) : payout.paymentStatus === PayoutPaymentStatus.FAILED ? (
                  // Payment failed
                  <p className="mt-1 text-xs text-red-700/70 dark:text-red-400/70">
                    The payment failed. The founder will need to retry the
                    payment.
                  </p>
                ) : (
                  // Founder hasn't started payment yet (PENDING)
                  <p className="mt-1 text-xs text-yellow-700/70 dark:text-yellow-400/70">
                    The founder hasn&apos;t completed the payout payment yet.
                  </p>
                )}
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
            {/* Header with Pay button */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                {payout.periodLabel} Split
              </span>
              {isFounder &&
                payout.paymentStatus !== PayoutPaymentStatus.PAID && (
                  <AppButton
                    size="sm"
                    onClick={handlePayWithStripe}
                    disabled={isRedirectingToStripe}
                    className="h-7 text-xs"
                  >
                    {isRedirectingToStripe ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <CreditCard02 className="mr-1 size-3" />
                    )}
                    Pay with Stripe
                  </AppButton>
                )}
              {isFounder &&
                payout.paymentStatus === PayoutPaymentStatus.PAID && (
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <Check className="size-3" />
                    <span>Paid</span>
                  </div>
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
            </div>

            {/* Distribution bar - shows money split between contributors and platform fee */}
            <div className="flex h-8 overflow-hidden rounded-lg bg-muted/50">
              {(() => {
                // Use distributed + platform fee as the base for bar percentages
                // This excludes Stripe processing fees so the bar fills 100%
                const barTotal =
                  payout.recipients.reduce((sum, r) => sum + r.amountCents, 0) +
                  payout.platformFeeCents
                return (
                  <>
                    {payout.recipients.map((recipient, index) => {
                      const amountPercent =
                        (recipient.amountCents / barTotal) * 100
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
                          width: `${(payout.platformFeeCents / barTotal) * 100}%`,
                        }}
                        transition={{
                          duration: 0.6,
                          delay: payout.recipients.length * 0.08,
                          ease: [0.34, 1.56, 0.64, 1],
                        }}
                        className="h-full hover:opacity-80"
                        style={{
                          backgroundColor: getChartColor(
                            payout.recipients.length,
                          ),
                        }}
                        title={`Shippy: ${formatCurrency(payout.platformFeeCents)} (${formatPercentage((payout.platformFeeCents / barTotal) * 100)})`}
                      />
                    )}
                  </>
                )
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
                          {/* Payment status icon - Stripe transfer auto-verifies */}
                          {isPaid && (
                            <div className="flex size-7 items-center justify-center">
                              <CheckCircle className="size-3.5 text-primary" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}

              {/* Shippy Platform Fee - only show to those who can see financials */}
              {payout.platformFeeCents > 0 &&
                canSeeFinancials &&
                (() => {
                  const shippyColor = getChartColor(payout.recipients.length)
                  const isPaid =
                    payout.paymentStatus === PayoutPaymentStatus.PAID
                  return (
                    <div className="rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: shippyColor }}
                          />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/logo-mark.svg"
                            alt="Shippy"
                            className="size-6"
                          />
                          <div>
                            <span className="text-sm font-medium">Shippy</span>
                            {isPaid && (
                              <div className="flex items-center gap-1">
                                <Check className="size-3 text-primary" />
                                <span className="text-[10px] text-primary">
                                  Paid
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-sm font-semibold text-muted-foreground">
                              {formatCurrency(payout.platformFeeCents)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {payout.project.rewardPool
                                ?.platformFeePercentage ?? 2}
                              %
                            </div>
                          </div>
                          {isPaid && (
                            <div className="flex size-7 items-center justify-center">
                              <CheckCircle className="size-3.5 text-primary" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}
            </div>

            {/* Fee breakdown & Total - only show if user can see financials */}
            {canSeeFinancials && (
              <div className="space-y-2 border-t border-border pt-3">
                {/* To contributors */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">To contributors</span>
                  <span className="font-medium">
                    {formatCurrency(payout.distributedAmountCents)}
                  </span>
                </div>
                {/* Platform fee */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Platform fee (
                    {payout.project.rewardPool?.platformFeePercentage ?? 2}%)
                  </span>
                  <span className="font-medium">
                    {formatCurrency(payout.platformFeeCents)}
                  </span>
                </div>
                {/* Stripe fee */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Stripe fee</span>
                  <span className="font-medium">
                    {formatCurrency(payout.stripeFeeCents ?? 0)}
                  </span>
                </div>
                {/* Total */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-medium">
                    {payout.paymentStatus === PayoutPaymentStatus.PAID
                      ? 'Paid'
                      : 'Payout amount'}
                  </span>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(payout.founderTotalCents ?? 0)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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
