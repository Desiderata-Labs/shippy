'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  ArrowUpRight,
  Clock,
  CoinsStacked01,
  Target01,
} from '@untitled-ui/icons-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  const { data: session, isPending: sessionLoading } = useSession()
  const { data, isLoading } = trpc.contributor.myDashboard.useQuery(undefined, {
    enabled: !!session,
  })

  if (sessionLoading) {
    return <DashboardSkeleton />
  }

  if (!session) {
    redirect('/sign-in')
  }

  if (isLoading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome back, {session.user.name}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points</CardTitle>
            <Target01 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.totalPointsAllProjects.toLocaleString() ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {data?.projects.length ?? 0} projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Lifetime Earnings
            </CardTitle>
            <CoinsStacked01 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data?.totalLifetimeEarnings ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">Confirmed payouts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Payouts
            </CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.totalPendingPayouts ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting confirmation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Projects
            </CardTitle>
            <ArrowUpRight className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.projects.length ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Contributing to</p>
          </CardContent>
        </Card>
      </div>

      {/* Projects */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My Projects</CardTitle>
            <CardDescription>
              Projects you&apos;re contributing to
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!data || data.projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Target01 className="mb-4 size-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  You haven&apos;t contributed to any projects yet.
                </p>
                <Button asChild className="mt-4 cursor-pointer">
                  <Link href="/discover">Find Projects</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.projects.map((project) => (
                  <Link
                    key={project.projectId}
                    href={`/project/${project.projectSlug}`}
                    className="flex items-center justify-between py-4 transition-colors first:pt-0 last:pb-0 hover:bg-muted/50"
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Payouts</CardTitle>
            <CardDescription>Your recent earnings</CardDescription>
          </CardHeader>
          <CardContent>
            {!data || data.recentPayouts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CoinsStacked01 className="mb-4 size-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No payouts received yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-5 w-64" />
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-1 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
