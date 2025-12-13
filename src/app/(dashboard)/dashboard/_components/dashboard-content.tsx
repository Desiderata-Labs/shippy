'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock,
  CoinsStacked01,
  MessageTextSquare02,
  Target01,
  X,
} from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { redirect, useRouter } from 'next/navigation'
import {
  PayoutRecipientStatus,
  PayoutStatus,
  SubmissionStatus,
} from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { submissionStatusLabels } from '@/lib/status-colors'
import { cn } from '@/lib/utils'
import {
  AppButton,
  AppCard,
  AppCardContent,
  AppCardDescription,
  AppCardHeader,
  AppCardTitle,
  AppTextarea,
} from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function DashboardContent() {
  const router = useRouter()
  const { data: session, isPending: sessionLoading } = useSession()
  const [confirmingPayoutId, setConfirmingPayoutId] = useState<string | null>(
    null,
  )
  const [showDisputeForm, setShowDisputeForm] = useState<string | null>(null)
  const [disputeReason, setDisputeReason] = useState('')

  const { data, isLoading } = trpc.contributor.myDashboard.useQuery(undefined, {
    enabled: !!session,
  })

  const { data: submissions } = trpc.submission.mySubmissions.useQuery(
    {},
    { enabled: !!session },
  )

  const utils = trpc.useUtils()

  const confirmReceipt = trpc.payout.confirmReceipt.useMutation({
    onSuccess: () => {
      toast.success('Receipt confirmed!')
      utils.contributor.myDashboard.invalidate()
      setConfirmingPayoutId(null)
      setShowDisputeForm(null)
      setDisputeReason('')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Check if user needs onboarding (no username set)
  const { data: userData, isLoading: userLoading } = trpc.user.me.useQuery(
    undefined,
    {
      enabled: !!session,
    },
  )

  // Redirect to onboarding if user doesn't have a username
  useEffect(() => {
    if (!userLoading && userData?.needsOnboarding) {
      router.replace(routes.auth.onboarding())
    }
  }, [userData, userLoading, router])

  if (sessionLoading || userLoading) {
    return <DashboardSkeleton />
  }

  if (!session) {
    redirect(routes.auth.signIn())
  }

  // Don't render dashboard if user needs onboarding
  if (userData?.needsOnboarding) {
    return <DashboardSkeleton />
  }

  if (isLoading) {
    return <DashboardSkeleton />
  }

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Welcome back, {session.user.name}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AppCard>
            <AppCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <AppCardTitle className="text-sm font-medium">
                Total Points
              </AppCardTitle>
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Target01 className="size-4 text-primary" />
              </div>
            </AppCardHeader>
            <AppCardContent>
              <div className="text-2xl font-bold">
                {data?.totalPointsAllProjects.toLocaleString() ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Across {data?.projects.length ?? 0} projects
              </p>
            </AppCardContent>
          </AppCard>

          <AppCard>
            <AppCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <AppCardTitle className="text-sm font-medium">
                Lifetime Earnings
              </AppCardTitle>
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <CoinsStacked01 className="size-4 text-primary" />
              </div>
            </AppCardHeader>
            <AppCardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(data?.totalLifetimeEarnings ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground">Confirmed payouts</p>
            </AppCardContent>
          </AppCard>

          <AppCard>
            <AppCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <AppCardTitle className="text-sm font-medium">
                Pending Payouts
              </AppCardTitle>
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="size-4 text-primary" />
              </div>
            </AppCardHeader>
            <AppCardContent>
              <div className="text-2xl font-bold">
                {data?.totalPendingPayouts ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Awaiting confirmation
              </p>
            </AppCardContent>
          </AppCard>

          <AppCard>
            <AppCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <AppCardTitle className="text-sm font-medium">
                Active Projects
              </AppCardTitle>
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <ArrowUpRight className="size-4 text-primary" />
              </div>
            </AppCardHeader>
            <AppCardContent>
              <div className="text-2xl font-bold">
                {data?.projects.length ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">Contributing to</p>
            </AppCardContent>
          </AppCard>
        </div>

        {/* My Submissions */}
        {submissions && submissions.length > 0 && (
          <div className="mb-6">
            <AppCard>
              <AppCardHeader>
                <AppCardTitle>My Submissions</AppCardTitle>
                <AppCardDescription>
                  Track your submitted work
                </AppCardDescription>
              </AppCardHeader>
              <AppCardContent>
                <div className="divide-y divide-border/50 dark:divide-white/10">
                  {submissions.slice(0, 5).map((submission) => {
                    const statusConfig: Record<
                      string,
                      { label: string; color: string }
                    > = {
                      [SubmissionStatus.DRAFT]: {
                        label: submissionStatusLabels.DRAFT,
                        color: 'bg-muted text-muted-foreground border-border',
                      },
                      [SubmissionStatus.PENDING]: {
                        label: submissionStatusLabels.PENDING,
                        color:
                          'bg-purple-500/10 text-purple-500 border-purple-500/20',
                      },
                      [SubmissionStatus.NEEDS_INFO]: {
                        label: submissionStatusLabels.NEEDS_INFO,
                        color:
                          'bg-orange-500/10 text-orange-500 border-orange-500/20',
                      },
                      [SubmissionStatus.APPROVED]: {
                        label: submissionStatusLabels.APPROVED,
                        color:
                          'bg-green-500/10 text-green-500 border-green-500/20',
                      },
                      [SubmissionStatus.REJECTED]: {
                        label: submissionStatusLabels.REJECTED,
                        color: 'bg-red-500/10 text-red-500 border-red-500/20',
                      },
                    }

                    const status =
                      statusConfig[submission.status] ??
                      statusConfig[SubmissionStatus.PENDING]

                    return (
                      <Link
                        key={submission.id}
                        href={routes.project.submissionDetail({
                          slug: submission.bounty.project.slug,
                          submissionId: submission.id,
                          title: submission.bounty.title,
                        })}
                        className="group -mx-4 flex items-center justify-between rounded-lg p-4 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn('text-xs', status.color)}
                            >
                              {status.label}
                            </Badge>
                            {submission._count.events > 0 && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MessageTextSquare02 className="size-3" />
                                {submission._count.events}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate font-medium">
                            {submission.bounty.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {submission.bounty.project.name}
                          </p>
                        </div>
                        <div className="ml-4 flex items-center gap-2">
                          {submission.pointsAwarded && (
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">
                              +{submission.pointsAwarded} pts
                            </span>
                          )}
                          <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </AppCardContent>
            </AppCard>
          </div>
        )}

        {/* Projects */}
        <div className="grid gap-6 lg:grid-cols-2">
          <AppCard>
            <AppCardHeader>
              <AppCardTitle>My Projects</AppCardTitle>
              <AppCardDescription>
                Projects you&apos;re contributing to
              </AppCardDescription>
            </AppCardHeader>
            <AppCardContent>
              {!data || data.projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                    <Target01 className="size-6 text-primary" />
                  </div>
                  <p className="text-muted-foreground">
                    You haven&apos;t contributed to any projects yet.
                  </p>
                  <AppButton asChild className="mt-4">
                    <Link href={routes.discover.root()}>Find Projects</Link>
                  </AppButton>
                </div>
              ) : (
                <div className="divide-y divide-border/50 dark:divide-white/10">
                  {data.projects.map((project) => (
                    <Link
                      key={project.projectId}
                      href={routes.project.detail({
                        slug: project.projectSlug,
                      })}
                      className="-mx-4 flex items-center justify-between rounded-lg p-4 transition-colors hover:bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{project.projectName}</p>
                        <p className="text-sm text-muted-foreground">
                          {project.points.toLocaleString()} points
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(project.lifetimeEarningsCents)}
                        </p>
                        {project.pendingPayouts > 0 && (
                          <Badge variant="secondary" className="mt-1">
                            {project.pendingPayouts} pending
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </AppCardContent>
          </AppCard>

          <AppCard>
            <AppCardHeader>
              <AppCardTitle>Recent Payouts</AppCardTitle>
              <AppCardDescription>Your recent earnings</AppCardDescription>
            </AppCardHeader>
            <AppCardContent>
              {!data || data.recentPayouts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                    <CoinsStacked01 className="size-6 text-primary" />
                  </div>
                  <p className="text-muted-foreground">
                    No payouts received yet.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50 dark:divide-white/10">
                  {data.recentPayouts.map((recipient) => {
                    const needsConfirmation =
                      recipient.status === PayoutRecipientStatus.PENDING &&
                      recipient.payout.status === PayoutStatus.SENT

                    const handleConfirm = async () => {
                      setConfirmingPayoutId(recipient.payoutId)
                      try {
                        await confirmReceipt.mutateAsync({
                          payoutId: recipient.payoutId,
                          confirmed: true,
                        })
                      } finally {
                        setConfirmingPayoutId(null)
                      }
                    }

                    const handleDispute = async () => {
                      setConfirmingPayoutId(recipient.payoutId)
                      try {
                        await confirmReceipt.mutateAsync({
                          payoutId: recipient.payoutId,
                          confirmed: false,
                          disputeReason:
                            disputeReason || 'Payment not received',
                        })
                      } finally {
                        setConfirmingPayoutId(null)
                      }
                    }

                    return (
                      <div key={recipient.id} className="-mx-4 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {recipient.payout.project.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {recipient.payout.periodLabel}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              {formatCurrency(recipient.amountCents)}
                            </p>
                            <Badge
                              variant={
                                recipient.status ===
                                PayoutRecipientStatus.CONFIRMED
                                  ? 'default'
                                  : recipient.status ===
                                      PayoutRecipientStatus.DISPUTED
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {recipient.status.toLowerCase()}
                            </Badge>
                          </div>
                        </div>

                        {/* Confirmation actions */}
                        {needsConfirmation &&
                          showDisputeForm !== recipient.payoutId && (
                            <div className="mt-3 flex gap-2">
                              <AppButton
                                size="sm"
                                onClick={handleConfirm}
                                disabled={
                                  confirmingPayoutId === recipient.payoutId
                                }
                                className="flex-1 bg-green-600 hover:bg-green-700"
                              >
                                {confirmingPayoutId === recipient.payoutId ? (
                                  <Loader2 className="mr-2 size-3 animate-spin" />
                                ) : (
                                  <Check className="mr-2 size-3" />
                                )}
                                Confirm Received
                              </AppButton>
                              <AppButton
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setShowDisputeForm(recipient.payoutId)
                                }
                                disabled={
                                  confirmingPayoutId === recipient.payoutId
                                }
                                className="text-red-500 hover:bg-red-500/10"
                              >
                                <X className="mr-2 size-3" />
                                Not Received
                              </AppButton>
                            </div>
                          )}

                        {/* Dispute form */}
                        {showDisputeForm === recipient.payoutId && (
                          <div className="mt-3 space-y-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                            <p className="text-xs font-medium text-red-500">
                              Report a problem with this payout
                            </p>
                            <AppTextarea
                              value={disputeReason}
                              onChange={(e) => setDisputeReason(e.target.value)}
                              placeholder="Describe the issue..."
                              rows={2}
                              disabled={
                                confirmingPayoutId === recipient.payoutId
                              }
                            />
                            <div className="flex gap-2">
                              <AppButton
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setShowDisputeForm(null)
                                  setDisputeReason('')
                                }}
                                disabled={
                                  confirmingPayoutId === recipient.payoutId
                                }
                              >
                                Cancel
                              </AppButton>
                              <AppButton
                                size="sm"
                                onClick={handleDispute}
                                disabled={
                                  confirmingPayoutId === recipient.payoutId
                                }
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {confirmingPayoutId === recipient.payoutId ? (
                                  <Loader2 className="mr-2 size-3 animate-spin" />
                                ) : (
                                  <X className="mr-2 size-3" />
                                )}
                                Submit Dispute
                              </AppButton>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </AppCardContent>
          </AppCard>
        </div>
      </div>
    </AppBackground>
  )
}

function DashboardSkeleton() {
  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="mt-2 h-5 w-64" />
        </div>
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <AppCard key={i}>
              <AppCardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </AppCardHeader>
              <AppCardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="mt-1 h-3 w-32" />
              </AppCardContent>
            </AppCard>
          ))}
        </div>
      </div>
    </AppBackground>
  )
}
