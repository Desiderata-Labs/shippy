'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  ArrowUpRight,
  Clock,
  CoinsStacked01,
  Target01,
} from '@untitled-ui/icons-react'
import { useEffect } from 'react'
import Link from 'next/link'
import { redirect, useRouter } from 'next/navigation'
import { routes } from '@/lib/routes'
import {
  AppButton,
  AppCard,
  AppCardContent,
  AppCardDescription,
  AppCardHeader,
  AppCardTitle,
} from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export default function ContributorDashboardPage() {
  const router = useRouter()
  const { data: session, isPending: sessionLoading } = useSession()
  const { data, isLoading } = trpc.contributor.myDashboard.useQuery(undefined, {
    enabled: !!session,
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
      <div className="container px-4 py-8">
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
                      className="flex items-center justify-between rounded-lg py-4 transition-colors first:pt-0 last:pb-0 hover:bg-muted/50"
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
                  {data.recentPayouts.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                    >
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
                            recipient.status === 'CONFIRMED'
                              ? 'default'
                              : recipient.status === 'DISPUTED'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {recipient.status.toLowerCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
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
      <div className="container px-4 py-8">
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
