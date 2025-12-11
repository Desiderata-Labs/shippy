'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  Calendar,
  Check,
  CoinsStacked01,
  Users01,
} from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { notFound, redirect } from 'next/navigation'
import { routes } from '@/lib/routes'
import {
  AppButton,
  AppCard,
  AppCardContent,
  AppCardDescription,
  AppCardHeader,
  AppCardTitle,
  AppInput,
} from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
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

export default function NewPayoutPage() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const { data: session, isPending: sessionLoading } = useSession()
  const [isCreating, setIsCreating] = useState(false)

  // Form state
  const [profitDollars, setProfitDollars] = useState('')
  const [periodLabel, setPeriodLabel] = useState(() => {
    // Default to current month
    const now = new Date()
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  })
  const [periodStart, setPeriodStart] = useState(() => {
    // Default to first of current month
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0]
  })
  const [periodEnd, setPeriodEnd] = useState(() => {
    // Default to today
    return new Date().toISOString().split('T')[0]
  })

  // Fetch project data
  const { data: project, isLoading: projectLoading } =
    trpc.project.getBySlug.useQuery(
      { slug: params.slug },
      { enabled: !!params.slug },
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
      // Keep previous data to prevent flickering during updates
      placeholderData: (previousData) => previousData,
    },
  )

  const utils = trpc.useUtils()

  const createPayout = trpc.payout.create.useMutation({
    onSuccess: () => {
      toast.success('Payout created!')
      utils.payout.getByProject.invalidate({ projectId: project?.id })
      router.push(routes.project.payouts({ slug: params.slug }))
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Loading states
  if (sessionLoading || projectLoading) {
    return (
      <AppBackground>
        <div className="container max-w-3xl px-4 py-8">
          <Skeleton className="mb-4 h-6 w-32" />
          <Skeleton className="mb-8 h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppBackground>
    )
  }

  // Auth check
  if (!session) {
    redirect(routes.auth.signIn())
  }

  // Project not found
  if (!project) {
    notFound()
  }

  // Check if user is the founder
  if (project.founderId !== session.user.id) {
    notFound()
  }

  if (!project.rewardPool) {
    return (
      <AppBackground>
        <div className="container max-w-3xl px-4 py-8">
          <AppCard>
            <AppCardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                This project doesn&apos;t have a reward pool configured.
              </p>
            </AppCardContent>
          </AppCard>
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

  return (
    <AppBackground>
      <div className="container max-w-3xl px-4 py-8">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={routes.project.detail({ slug: params.slug })}>
                  {project.name}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={routes.project.payouts({ slug: params.slug })}>
                  Payouts
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>New</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Create Payout</h1>
          <p className="mt-2 text-muted-foreground">
            Enter your profit for the period and distribute the reward pool
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Period Settings */}
          <AppCard>
            <AppCardHeader>
              <AppCardTitle className="flex items-center gap-2">
                <Calendar className="size-4" />
                Payout Period
              </AppCardTitle>
              <AppCardDescription>
                Define the period this payout covers
              </AppCardDescription>
            </AppCardHeader>
            <AppCardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="periodLabel">Period Label</Label>
                <AppInput
                  id="periodLabel"
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  placeholder="e.g., December 2024 or Q4 2024"
                  required
                  disabled={isCreating}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="periodStart">Start Date</Label>
                  <AppInput
                    id="periodStart"
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    required
                    disabled={isCreating}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodEnd">End Date</Label>
                  <AppInput
                    id="periodEnd"
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    required
                    disabled={isCreating}
                  />
                </div>
              </div>
            </AppCardContent>
          </AppCard>

          {/* Profit Input */}
          <AppCard>
            <AppCardHeader>
              <AppCardTitle className="flex items-center gap-2">
                <CoinsStacked01 className="size-4" />
                Reported Profit
              </AppCardTitle>
              <AppCardDescription>
                Enter your net profit for this period. The reward pool (
                {project.rewardPool.poolPercentage}%) will be calculated from
                this amount.
              </AppCardDescription>
            </AppCardHeader>
            <AppCardContent>
              <div className="space-y-2">
                <Label htmlFor="profit">Net Profit ($)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-lg text-muted-foreground">$</span>
                  <AppInput
                    id="profit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={profitDollars}
                    onChange={(e) => setProfitDollars(e.target.value)}
                    placeholder="0.00"
                    required
                    disabled={isCreating}
                    className="text-lg"
                  />
                </div>
              </div>
            </AppCardContent>
          </AppCard>

          {/* Preview - always visible */}
          <AppCard>
            <AppCardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <AppCardTitle className="flex items-center gap-2">
                    <Users01 className="size-4" />
                    Payout Preview
                  </AppCardTitle>
                  <AppCardDescription>
                    How the reward pool will be distributed
                  </AppCardDescription>
                </div>
                {previewFetching && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </AppCardHeader>
            <AppCardContent>
              {profitCents === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Enter a profit amount above to see the payout preview
                  </p>
                </div>
              ) : previewLoading && !preview ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : preview ? (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Reported Profit
                      </p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(preview.reportedProfitCents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Pool ({preview.poolPercentage}%)
                      </p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(preview.poolAmountCents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Earned / Capacity
                      </p>
                      <p className="text-lg font-semibold">
                        {preview.totalEarnedPoints} / {preview.poolCapacity} pts
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        To Distribute
                      </p>
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(preview.distributedAmountCents)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        (
                        {formatPercentage(
                          (preview.totalEarnedPoints / preview.poolCapacity) *
                            100,
                        )}{' '}
                        of pool)
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Contributors */}
                  {preview.breakdown.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        No contributors with points to pay out.
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Approve some submissions first to award points.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Contributor</span>
                        <span>Points / Share / Amount</span>
                      </div>
                      {preview.breakdown.map((recipient) => (
                        <div
                          key={recipient.userId}
                          className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarImage
                                src={recipient.userImage ?? undefined}
                              />
                              <AvatarFallback>
                                {recipient.userName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {recipient.userName}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600 dark:text-green-400">
                              {formatCurrency(recipient.amountCents)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {recipient.points} pts (
                              {formatPercentage(recipient.sharePercent)})
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Total */}
                      <div className="flex items-center justify-between border-t border-border pt-3">
                        <span className="font-medium">
                          Total to Contributors
                        </span>
                        <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(preview.distributedAmountCents)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </AppCardContent>
          </AppCard>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <AppButton
              type="button"
              variant="outline"
              onClick={() =>
                router.push(routes.project.detail({ slug: params.slug }))
              }
              disabled={isCreating}
            >
              Cancel
            </AppButton>
            <AppButton type="submit" disabled={isCreating || !isValid}>
              {isCreating && <Loader2 className="mr-2 size-4 animate-spin" />}
              <Check className="mr-2 size-4" />
              Create Payout
            </AppButton>
          </div>
        </form>
      </div>
    </AppBackground>
  )
}
