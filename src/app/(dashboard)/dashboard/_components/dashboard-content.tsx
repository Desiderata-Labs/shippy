'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock,
  CoinsStacked01,
  Folder,
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
import { AppButton, AppTextarea } from '@/components/app'
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

function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'isolate rounded-xl bg-card/50 p-4 shadow-lg ring-1 ring-border backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </div>
  )
}

function StatCard({
  icon: Icon,
  value,
  label,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: React.ReactNode
  label: string
  highlight?: boolean
}) {
  return (
    <GlassCard className="p-3">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex size-6 items-center justify-center rounded-sm',
            highlight ? 'bg-green-500/10' : 'bg-muted',
          )}
        >
          <Icon
            className={cn(
              'size-3.5',
              highlight ? 'text-green-500' : 'text-muted-foreground',
            )}
          />
        </div>
        <div>
          <p className={cn('text-sm font-bold', highlight && 'text-green-500')}>
            {value}
          </p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      </div>
    </GlassCard>
  )
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
        {/* Header */}
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <span className="text-muted-foreground">Dashboard</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-foreground">{session.user.name}</span>
          </h1>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={Target01}
            value={data?.totalPointsAllProjects.toLocaleString() ?? '0'}
            label={`Across ${data?.projects.length ?? 0} projects`}
          />
          <StatCard
            icon={CoinsStacked01}
            value={formatCurrency(data?.totalLifetimeEarnings ?? 0)}
            label="Lifetime earnings"
            highlight
          />
          <StatCard
            icon={Clock}
            value={(data?.totalPendingPayouts ?? 0).toString()}
            label="Pending payouts"
          />
          <StatCard
            icon={ArrowUpRight}
            value={(data?.projects.length ?? 0).toString()}
            label="Active projects"
          />
        </div>

        {/* Main content grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* My Submissions */}
          {submissions && submissions.length > 0 && (
            <GlassCard className="overflow-hidden p-0 lg:col-span-2">
              <div className="border-b border-border px-4 py-2.5">
                <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  My Submissions
                </h3>
              </div>
              <div className="divide-y divide-border">
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
                      className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">
                            {submission.bounty.title}
                          </p>
                          {submission._count.events > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MessageTextSquare02 className="size-3" />
                              {submission._count.events}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {submission.bounty.project.name}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn('text-[10px]', status.color)}
                        >
                          {status.label}
                        </Badge>
                        {submission.pointsAwarded && (
                          <span className="text-xs font-medium text-green-500">
                            +{submission.pointsAwarded} pts
                          </span>
                        )}
                        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </GlassCard>
          )}

          {/* My Projects */}
          <GlassCard className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2.5">
              <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                My Projects
              </h3>
            </div>
            {!data || data.projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                  <Folder className="size-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold">No projects yet</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  You haven&apos;t contributed to any projects yet.
                </p>
                <AppButton asChild className="mt-4" size="sm">
                  <Link href={routes.discover.root()}>Find Projects</Link>
                </AppButton>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.projects.map((project) => (
                  <Link
                    key={project.projectId}
                    href={routes.project.detail({
                      slug: project.projectSlug,
                    })}
                    className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">
                        {project.projectName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {project.points.toLocaleString()} points
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold text-green-500">
                        {formatCurrency(project.lifetimeEarningsCents)}
                      </span>
                      {project.pendingPayouts > 0 && (
                        <Badge
                          variant="outline"
                          className="border-yellow-500/20 bg-yellow-500/10 text-[10px] text-yellow-600 dark:text-yellow-400"
                        >
                          {project.pendingPayouts} pending
                        </Badge>
                      )}
                      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Recent Payouts */}
          <GlassCard className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2.5">
              <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Recent Payouts
              </h3>
            </div>
            {!data || data.recentPayouts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                  <CoinsStacked01 className="size-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold">No payouts yet</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Payouts will appear here once you earn them.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
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
                        disputeReason: disputeReason || 'Payment not received',
                      })
                    } finally {
                      setConfirmingPayoutId(null)
                    }
                  }

                  const statusBadge = {
                    [PayoutRecipientStatus.CONFIRMED]: {
                      label: 'Confirmed',
                      color:
                        'bg-green-500/10 text-green-500 border-green-500/20',
                    },
                    [PayoutRecipientStatus.DISPUTED]: {
                      label: 'Disputed',
                      color: 'bg-red-500/10 text-red-500 border-red-500/20',
                    },
                    [PayoutRecipientStatus.PENDING]: {
                      label: 'Pending',
                      color:
                        'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
                    },
                  }

                  const badge =
                    statusBadge[recipient.status as keyof typeof statusBadge] ??
                    statusBadge[PayoutRecipientStatus.PENDING]

                  return (
                    <div key={recipient.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {recipient.payout.project.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {recipient.payout.periodLabel}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-semibold text-green-500">
                            {formatCurrency(recipient.amountCents)}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px]', badge.color)}
                          >
                            {badge.label}
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
                              Confirm
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
                              Dispute
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
                            disabled={confirmingPayoutId === recipient.payoutId}
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
                              Submit
                            </AppButton>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </AppBackground>
  )
}

function DashboardSkeleton() {
  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </AppBackground>
  )
}
