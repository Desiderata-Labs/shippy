'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  ArrowUpRight,
  BankNote03,
  ChevronRight,
  Clock,
  Folder,
  MessageTextSquare02,
  Target01,
} from '@untitled-ui/icons-react'
import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { redirect, useRouter } from 'next/navigation'
import { SubmissionStatus } from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { submissionStatusLabels } from '@/lib/status-colors'
import { cn } from '@/lib/utils'
import { AppButton } from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
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
    <Card className="p-3">
      <div className="flex items-start gap-2">
        <div className="flex size-6 items-center justify-center rounded-sm">
          <Icon className="-mt-1 size-3.5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold">{value}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  )
}

export function DashboardContent() {
  const router = useRouter()
  const { data: session, isPending: sessionLoading } = useSession()
  const { data, isLoading } = trpc.contributor.myDashboard.useQuery(undefined, {
    enabled: !!session,
  })

  const { data: submissions } = trpc.submission.mySubmissions.useQuery(
    {},
    { enabled: !!session },
  )

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
      <div className="mx-auto max-w-7xl p-6">
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
            icon={BankNote03}
            value={formatCurrency(data?.totalLifetimeEarnings ?? 0)}
            label="Lifetime earnings"
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
            <div className="overflow-hidden p-0 lg:col-span-2">
              <div className="border-b border-border px-4 py-2.5">
                <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  My Submissions
                </h3>
              </div>
              <div>
                {submissions.slice(0, 5).map((submission, index) => {
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
                        'bg-amber-500/10 text-amber-500 border-amber-500/20',
                    },
                    [SubmissionStatus.APPROVED]: {
                      label: submissionStatusLabels.APPROVED,
                      color: 'bg-primary/10 text-primary border-primary/20',
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
                    <div key={submission.id}>
                      {index > 0 && <Separator className="ml-4" />}
                      <Link
                        href={routes.project.submissionDetail({
                          slug: submission.bounty.project.slug,
                          bountyId: submission.bountyId,
                          submissionId: submission.id,
                          title: submission.bounty.title,
                        })}
                        className="group ml-4 flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
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
                            <span className="text-xs font-medium text-primary">
                              +{submission.pointsAwarded} pts
                            </span>
                          )}
                          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Contributed Projects */}
          <div className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2.5">
              <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Projects You&apos;ve Contributed To
              </h3>
            </div>
            {!data || data.projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
                  <Folder className="size-6 opacity-50" />
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
              <div>
                {data.projects.map((project, index) => (
                  <div key={project.projectId}>
                    {index > 0 && <Separator className="ml-4" />}
                    <Link
                      href={routes.project.detail({
                        slug: project.projectSlug,
                      })}
                      className="group ml-4 flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {project.projectLogoUrl ? (
                          <Image
                            src={project.projectLogoUrl}
                            alt={project.projectName}
                            width={32}
                            height={32}
                            className="size-8 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-bold">
                            {project.projectName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">
                            {project.projectName}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {project.points.toLocaleString()} points
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-primary">
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
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Payouts */}
          <div className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2.5">
              <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Recent Payouts
              </h3>
            </div>
            {!data || data.recentPayouts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
                  <BankNote03 className="size-6 opacity-50" />
                </div>
                <h3 className="text-base font-semibold">No payouts yet</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Payouts will appear here once you earn them.
                </p>
              </div>
            ) : (
              <div>
                {data.recentPayouts.map((recipient, index) => {
                  // Stripe transfers auto-verify payment - simple paid/pending status
                  const isPaid = !!recipient.paidAt
                  const badge = isPaid
                    ? {
                        label: 'Paid',
                        color: 'bg-primary/10 text-primary border-primary/20',
                      }
                    : {
                        label: 'Pending',
                        color:
                          'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
                      }

                  return (
                    <div key={recipient.id}>
                      {index > 0 && <Separator className="ml-4" />}
                      <div className="ml-4 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            {recipient.payout.project.logoUrl ? (
                              <Image
                                src={recipient.payout.project.logoUrl}
                                alt={recipient.payout.project.name}
                                width={32}
                                height={32}
                                className="size-8 shrink-0 rounded-md object-cover"
                              />
                            ) : (
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-bold">
                                {recipient.payout.project.name
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {recipient.payout.project.name}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {recipient.payout.periodLabel}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-sm font-semibold text-primary">
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
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppBackground>
  )
}

function DashboardSkeleton() {
  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl p-6">
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
