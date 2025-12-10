'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  ArrowRight,
  CoinsStacked01,
  Plus,
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

export default function FounderDashboardPage() {
  const { data: session, isPending: sessionLoading } = useSession()
  const { data: projects, isLoading } = trpc.project.myProjects.useQuery(
    undefined,
    { enabled: !!session },
  )

  if (sessionLoading) {
    return <FounderSkeleton />
  }

  if (!session) {
    redirect('/sign-in')
  }

  if (isLoading) {
    return <FounderSkeleton />
  }

  return (
    <div className="container px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Projects</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your projects and bounties
          </p>
        </div>
        <Button asChild className="cursor-pointer">
          <Link href="/founder/new">
            <Plus className="mr-2 size-4" />
            New Project
          </Link>
        </Button>
      </div>

      {!projects || projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Target01 className="mb-4 size-12 text-muted-foreground" />
            <h2 className="text-xl font-semibold">No projects yet</h2>
            <p className="mt-2 max-w-sm text-muted-foreground">
              Create your first project to start attracting contributors and
              sharing the upside.
            </p>
            <Button asChild className="mt-4 cursor-pointer">
              <Link href="/founder/new">
                <Plus className="mr-2 size-4" />
                Create Your First Project
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/project/${project.slug}`}>
              <Card className="h-full cursor-pointer transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{project.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {project.tagline || 'No description'}
                      </CardDescription>
                    </div>
                    {project.rewardPool && (
                      <Badge variant="secondary">
                        {project.rewardPool.poolPercentage}% pool
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Target01 className="size-4 text-muted-foreground" />
                      <span>{project._count.bounties} bounties</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CoinsStacked01 className="size-4 text-muted-foreground" />
                      <span>{project._count.payouts} payouts</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Created{' '}
                      {new Date(project.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer"
                    >
                      Manage
                      <ArrowRight className="ml-1 size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function FounderSkeleton() {
  return (
    <div className="container px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="mt-2 h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="mt-1 h-4 w-48" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
