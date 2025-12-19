'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { Check } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { redirect } from 'next/navigation'
import { PoolType } from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { ProjectTab } from '@/lib/routes'
import { AppButton } from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import {
  PayoutFixedBudgetForm,
  PayoutProfitShareForm,
  PayoutPreview,
  PayoutSummaryStats,
} from '@/components/payout'
import { ErrorState } from '@/components/ui/error-state'
import { NotFoundState } from '@/components/ui/not-found-state'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export function NewPayoutContent() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const { data: session, isPending: sessionLoading } = useSession()
  const [isCreating, setIsCreating] = useState(false)

  // Form state - use stable defaults to avoid hydration mismatch
  const [profitDollars, setProfitDollars] = useState('')
  const [distributionDollars, setDistributionDollars] = useState('')
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

  // Determine pool type
  const poolType = project?.rewardPool?.poolType || PoolType.PROFIT_SHARE
  const isFixedBudget = poolType === PoolType.FIXED_BUDGET

  // Calculate amounts based on pool type
  const profitCents = Math.round((parseFloat(profitDollars) || 0) * 100)
  const distributionCents = Math.round(
    (parseFloat(distributionDollars) || 0) * 100,
  )

  // Use the appropriate amount for preview
  const {
    data: preview,
    isLoading: previewLoading,
    isFetching: previewFetching,
  } = trpc.payout.previewPayout.useQuery(
    {
      projectId: project?.id ?? '',
      ...(isFixedBudget
        ? { distributionCents }
        : { reportedProfitCents: profitCents }),
    },
    {
      enabled:
        !!project?.id &&
        (isFixedBudget ? distributionCents > 0 : profitCents > 0),
      placeholderData: (previousData) => previousData,
    },
  )

  const utils = trpc.useUtils()

  const createPayout = trpc.payout.create.useMutation({
    onSuccess: (data) => {
      toast.success('Payout created!')
      utils.payout.getByProject.invalidate({ projectId: project?.id })
      router.push(
        routes.project.payoutDetail({ slug: params.slug, payoutId: data.id }),
      )
    },
    onError: (error) => {
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
              This project doesn&apos;t have a reward pool configured.
            </p>
          </div>
        </div>
      </AppBackground>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const hasValidAmount = isFixedBudget
      ? distributionCents > 0
      : profitCents > 0

    if (!hasValidAmount || !preview || preview.breakdown.length === 0) return

    setIsCreating(true)
    try {
      await createPayout.mutateAsync({
        projectId: project.id,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        periodLabel,
        ...(isFixedBudget
          ? { distributionCents }
          : { reportedProfitCents: profitCents }),
      })
    } catch {
      // Error is handled by onError callback
    } finally {
      setIsCreating(false)
    }
  }

  const hasValidAmount = isFixedBudget
    ? distributionCents > 0
    : profitCents > 0

  const isValid =
    hasValidAmount &&
    periodLabel.trim() &&
    periodStart &&
    periodEnd &&
    preview &&
    preview.breakdown.length > 0

  // Budget info for fixed budget pools
  const budgetCents = Number(project.rewardPool.budgetCents ?? 0)
  const spentCents = Number(project.rewardPool.spentCents ?? 0)

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
              tab: ProjectTab.CONTRIBUTORS,
            })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Contributors
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground">New Payout</span>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Main layout - matching bounty editor */}
          <div className="grid gap-6 lg:grid-cols-[1fr_auto_340px]">
            {/* Left side - Main input area */}
            <div className="space-y-6">
              {/* Pool-type-specific form */}
              {isFixedBudget ? (
                <PayoutFixedBudgetForm
                  data={{
                    periodLabel,
                    periodStart,
                    periodEnd,
                    distributionDollars,
                  }}
                  onChange={(data) => {
                    if (data.periodLabel !== undefined)
                      setPeriodLabel(data.periodLabel)
                    if (data.periodStart !== undefined)
                      setPeriodStart(data.periodStart)
                    if (data.periodEnd !== undefined)
                      setPeriodEnd(data.periodEnd)
                    if (data.distributionDollars !== undefined)
                      setDistributionDollars(data.distributionDollars)
                  }}
                  budgetCents={budgetCents}
                  spentCents={spentCents}
                  disabled={isCreating}
                />
              ) : (
                <PayoutProfitShareForm
                  data={{
                    periodLabel,
                    periodStart,
                    periodEnd,
                    profitDollars,
                  }}
                  onChange={(data) => {
                    if (data.periodLabel !== undefined)
                      setPeriodLabel(data.periodLabel)
                    if (data.periodStart !== undefined)
                      setPeriodStart(data.periodStart)
                    if (data.periodEnd !== undefined)
                      setPeriodEnd(data.periodEnd)
                    if (data.profitDollars !== undefined)
                      setProfitDollars(data.profitDollars)
                  }}
                  poolPercentage={project.rewardPool.poolPercentage ?? 0}
                  disabled={isCreating}
                />
              )}

              {/* Pool summary stats - always visible when we have a preview */}
              {preview && hasValidAmount && (
                <PayoutSummaryStats
                  poolType={poolType}
                  poolAmountCents={preview.poolAmountCents}
                  poolPercentage={preview.poolPercentage}
                  poolCapacity={preview.poolCapacity}
                  totalEarnedPoints={preview.totalEarnedPoints}
                  distributedAmountCents={preview.distributedAmountCents}
                  recipientCount={preview.breakdown.length}
                  budgetInfo={preview.budgetInfo}
                />
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
              <PayoutPreview
                preview={preview}
                isLoading={previewLoading}
                isFetching={previewFetching}
                periodLabel={periodLabel}
                hasValidAmount={hasValidAmount}
                poolType={poolType}
              />
            </div>
          </div>
        </form>
      </div>
    </AppBackground>
  )
}
