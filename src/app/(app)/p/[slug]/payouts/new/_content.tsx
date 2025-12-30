'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { BankNote03, Calendar, Check } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { redirect } from 'next/navigation'
import { getChartColor } from '@/lib/chart-colors'
import { routes } from '@/lib/routes'
import { ProjectTab } from '@/lib/routes'
import { AppButton, AppInput } from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ErrorState } from '@/components/ui/error-state'
import { Label } from '@/components/ui/label'
import { NotFoundState } from '@/components/ui/not-found-state'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

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

export function NewPayoutContent() {
  const params = useParams<{ slug: string }>()
  const { data: session, isPending: sessionLoading } = useSession()
  const [isCreating, setIsCreating] = useState(false)

  // Form state - use stable defaults to avoid hydration mismatch
  // We use empty strings initially and populate on mount
  const [profitDollars, setProfitDollars] = useState('')
  const [periodLabel, setPeriodLabel] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [formInitialized, setFormInitialized] = useState(false)

  // Initialize form with current date on mount
  if (typeof window !== 'undefined' && !formInitialized) {
    const now = new Date()
    setPeriodLabel(
      now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    )
    setPeriodStart(
      new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0],
    )
    setPeriodEnd(now.toISOString().split('T')[0])
    setFormInitialized(true)
  }

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

  // Calculate payout preview
  const profitCents = Math.round((parseFloat(profitDollars) || 0) * 100)
  const {
    data: preview,
    isLoading: previewLoading,
    isFetching: previewFetching,
  } = trpc.payout.previewPayout.useQuery(
    { projectId: project?.id ?? '', reportedProfitCents: profitCents },
    {
      enabled: !!project?.id && profitCents > 0,
      placeholderData: (previousData) => previousData,
    },
  )

  const utils = trpc.useUtils()

  // Chain: Create payout → Redirect to Stripe Checkout
  const createPayoutCheckout = trpc.stripe.createPayoutCheckout.useMutation({
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      window.location.href = data.checkoutUrl
    },
    onError: (error) => {
      setIsCreating(false)
      toast.error(`Payment setup failed: ${error.message}`)
    },
  })

  const createPayout = trpc.payout.create.useMutation({
    onSuccess: async (data) => {
      toast.success('Payout created! Redirecting to payment...')
      utils.payout.getByProject.invalidate({ projectId: project?.id })

      // Immediately redirect to Stripe Checkout
      await createPayoutCheckout.mutateAsync({
        payoutId: data.id,
        projectSlug: params.slug,
      })
    },
    onError: (error) => {
      setIsCreating(false)
      toast.error(error.message)
    },
  })

  // Loading states
  if (sessionLoading || projectLoading) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          <div className="mb-6">
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="mb-6 h-8 w-48" />
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
  if (projectError) {
    const isNotFoundOrForbidden =
      projectErrorData?.data?.code === 'NOT_FOUND' ||
      projectErrorData?.data?.code === 'FORBIDDEN' ||
      projectErrorData?.data?.code === 'BAD_REQUEST'
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
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
        <div className="mx-auto max-w-7xl p-6">
          <NotFoundState
            resourceType="project"
            backHref={routes.dashboard.root()}
            backLabel="Back to Dashboard"
          />
        </div>
      </AppBackground>
    )
  }

  if (!project.rewardPool) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">
              This project doesn&apos;t have a profit share configured.
            </p>
          </div>
        </div>
      </AppBackground>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profitCents || !preview || preview.breakdown.length === 0) return

    setIsCreating(true)
    try {
      await createPayout.mutateAsync({
        projectId: project.id,
        reportedProfitCents: profitCents,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        periodLabel,
      })
    } catch {
      // Error is handled by onError callback
    } finally {
      setIsCreating(false)
    }
  }

  const isValid =
    profitCents > 0 &&
    periodLabel.trim() &&
    periodStart &&
    periodEnd &&
    preview &&
    preview.breakdown.length > 0

  const poolUtilization = preview
    ? (preview.totalEarnedPoints / preview.poolCapacity) * 100
    : 0

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl p-6">
        {/* Breadcrumb navigation */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link
            href={routes.project.detail({ slug: params.slug })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {project.name}
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
          <span className="text-foreground">New Payout</span>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Main layout - matching bounty editor */}
          <div className="grid gap-6 lg:grid-cols-[1fr_auto_340px]">
            {/* Left side - Main input area */}
            <div className="space-y-6">
              {/* Main input container */}
              <div className="rounded-lg border border-border bg-card">
                {/* Period label - inline style like bounty title */}
                <div className="px-4 py-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="size-3" />
                    Period Label
                  </div>
                  <input
                    type="text"
                    value={periodLabel}
                    onChange={(e) => setPeriodLabel(e.target.value)}
                    placeholder="e.g., December 2024 or Q4 2024"
                    required
                    disabled={isCreating}
                    className="w-full bg-transparent text-xl font-semibold placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                </div>

                <Separator />

                {/* Date range */}
                <div className="px-4 py-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="periodStart"
                        className="text-xs text-muted-foreground"
                      >
                        Start Date
                      </Label>
                      <AppInput
                        id="periodStart"
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        required
                        disabled={isCreating}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="periodEnd"
                        className="text-xs text-muted-foreground"
                      >
                        End Date
                      </Label>
                      <AppInput
                        id="periodEnd"
                        type="date"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        required
                        disabled={isCreating}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Profit input - prominent */}
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <BankNote03 className="size-3" />
                    Reported Profit
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl text-muted-foreground">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={profitDollars}
                      onChange={(e) => setProfitDollars(e.target.value)}
                      placeholder="0.00"
                      required
                      disabled={isCreating}
                      className="w-full bg-transparent text-3xl font-bold placeholder:text-muted-foreground/30 focus:outline-none"
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    The profit share ({project.rewardPool.poolPercentage}%) will
                    be calculated from this amount
                  </p>
                </div>
              </div>

              {/* Pool summary stats - always visible when we have a preview */}
              {preview && profitCents > 0 && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-card px-4 py-3">
                    <div className="text-xs text-muted-foreground">
                      Profit Share Amount
                    </div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(preview.poolAmountCents)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {preview.poolPercentage}% of profit
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-card px-4 py-3">
                    <div className="text-xs text-muted-foreground">
                      Profit Share Utilization
                    </div>
                    <div className="text-lg font-semibold">
                      {formatPercentage(poolUtilization)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {preview.totalEarnedPoints} / {preview.poolCapacity} pts
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-card px-4 py-3">
                    <div className="text-xs text-muted-foreground">
                      To Distribute
                    </div>
                    <div className="text-lg font-semibold text-primary">
                      {formatCurrency(preview.distributedAmountCents)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      to {preview.breakdown.length} contributor
                      {preview.breakdown.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Vertical separator */}
            <Separator orientation="vertical" className="hidden lg:block" />

            {/* Right side - Preview visualization */}
            <div className="space-y-4">
              {/* Submit button at top */}
              <AppButton
                type="submit"
                disabled={isCreating || !isValid}
                className="w-full"
                size="sm"
              >
                {isCreating && (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                )}
                <Check className="mr-1.5 size-3.5" />
                Create Payout
              </AppButton>

              <Separator />

              {/* Distribution Preview */}
              <div className="pt-2">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    {periodLabel} Split
                  </span>
                  {previewFetching && (
                    <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  )}
                </div>

                {profitCents === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Enter a profit amount to preview the split
                    </p>
                  </div>
                ) : previewLoading && !preview ? (
                  <div className="space-y-3">
                    <Skeleton className="h-8 w-full rounded-lg" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : preview ? (
                  <div className="space-y-4">
                    {preview.breakdown.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                        <p className="text-sm text-muted-foreground">
                          No contributors with points
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Approve submissions first
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Distribution bar - shows money split between contributors and platform fee */}
                        <div className="flex h-8 overflow-hidden rounded-lg bg-muted/50">
                          {(() => {
                            // Use distributed + platform fee as the base for bar percentages
                            // This excludes Stripe processing fees so the bar fills 100%
                            const barTotal =
                              preview.distributedAmountCents +
                              preview.platformFeeCents
                            return (
                              <>
                                {preview.breakdown.map((recipient, index) => {
                                  const amountPercent =
                                    (recipient.amountCents / barTotal) * 100
                                  return (
                                    <motion.div
                                      key={recipient.userId}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${amountPercent}%` }}
                                      transition={{
                                        duration: 0.6,
                                        delay: index * 0.08,
                                        ease: [0.34, 1.56, 0.64, 1],
                                      }}
                                      className="h-full hover:opacity-80"
                                      style={{
                                        backgroundColor: getChartColor(index),
                                      }}
                                      title={`${recipient.userName}: ${formatCurrency(recipient.amountCents)} (${formatPercentage(amountPercent)})`}
                                    />
                                  )
                                })}
                                {/* Shippy platform fee segment */}
                                {preview.platformFeeCents > 0 && (
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{
                                      width: `${(preview.platformFeeCents / barTotal) * 100}%`,
                                    }}
                                    transition={{
                                      duration: 0.6,
                                      delay: preview.breakdown.length * 0.08,
                                      ease: [0.34, 1.56, 0.64, 1],
                                    }}
                                    className="h-full hover:opacity-80"
                                    style={{
                                      backgroundColor: getChartColor(
                                        preview.breakdown.length,
                                      ),
                                    }}
                                    title={`Shippy: ${formatCurrency(preview.platformFeeCents)} (${formatPercentage((preview.platformFeeCents / barTotal) * 100)})`}
                                  />
                                )}
                              </>
                            )
                          })()}
                        </div>

                        {/* Contributors list */}
                        <div className="space-y-2">
                          {preview.breakdown.map((recipient, index) => (
                            <div
                              key={recipient.userId}
                              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="size-2.5 rounded-full"
                                  style={{
                                    backgroundColor: getChartColor(index),
                                  }}
                                />
                                <Avatar className="size-6">
                                  <AvatarImage
                                    src={recipient.userImage ?? undefined}
                                  />
                                  <AvatarFallback className="text-[10px]">
                                    {recipient.userName.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">
                                  {recipient.userName}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-primary">
                                  {formatCurrency(recipient.amountCents)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {recipient.points} pts (
                                  {formatPercentage(
                                    (recipient.amountCents /
                                      preview.poolAmountCents) *
                                      100,
                                  )}
                                  )
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* Shippy Platform Fee */}
                          {preview.platformFeeCents > 0 &&
                            (() => {
                              const shippyColor = getChartColor(
                                preview.breakdown.length,
                              )
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
                                      <span className="text-sm font-medium">
                                        Shippy
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-semibold text-muted-foreground">
                                        {formatCurrency(
                                          preview.platformFeeCents,
                                        )}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground">
                                        {preview.platformFeePercentage}%
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}
                        </div>

                        {/* Fee breakdown & Total - fees come OUT of what founder pays */}
                        <div className="space-y-2 border-t border-border pt-3">
                          {/* To contributors */}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              To contributors
                            </span>
                            <span className="font-medium">
                              {formatCurrency(preview.distributedAmountCents)}
                            </span>
                          </div>
                          {/* Platform fee */}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Platform fee ({preview.platformFeePercentage}%)
                            </span>
                            <span className="font-medium">
                              {formatCurrency(preview.platformFeeCents)}
                            </span>
                          </div>
                          {/* Stripe fee */}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Processing fee
                            </span>
                            <span className="font-medium">
                              {formatCurrency(preview.stripeFeeCents)}
                            </span>
                          </div>
                          {/* Total */}
                          <div className="flex items-center justify-between pt-2">
                            <span className="text-sm font-medium">
                              Payout amount
                            </span>
                            <span className="text-lg font-bold text-primary">
                              {formatCurrency(preview.founderPaysCents)}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </form>
      </div>
    </AppBackground>
  )
}
