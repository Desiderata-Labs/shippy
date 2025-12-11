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
import { redirect, useParams } from 'next/navigation'
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
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function UserProjectsPage() {
  const params = useParams<{ username: string }>()
  const { data: session, isPending: sessionLoading } = useSession()
  const { data: projects, isLoading } = trpc.project.myProjects.useQuery(
    undefined,
    { enabled: !!session },
  )

  // Check if viewing own projects
  const username = (session?.user as { username?: string })?.username
  const isOwnProfile = username === params.username

  if (sessionLoading) {
    return <ProjectsSkeleton />
  }

  // For now, only allow viewing own projects
  // TODO: Add public profile view for other users
  if (!session) {
    redirect(routes.auth.signIn())
  }

  if (!isOwnProfile) {
    // Redirect to own projects if trying to view someone else's
    if (username) {
      redirect(routes.user.projects({ username }))
    }
    redirect(routes.dashboard.root())
  }

  if (isLoading) {
    return <ProjectsSkeleton />
  }

  const newProjectUrl = routes.user.newProject({ username: params.username })

  return (
    <AppBackground>
      <div className="container px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Projects</h1>
            <p className="mt-2 text-muted-foreground">
              Manage your projects and bounties
            </p>
          </div>
          <AppButton asChild>
            <Link href={newProjectUrl}>
              <Plus className="mr-2 size-4" />
              New Project
            </Link>
          </AppButton>
        </div>

        {!projects || projects.length === 0 ? (
          <AppCard>
            <AppCardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <Target01 className="size-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">No projects yet</h2>
              <p className="mt-2 max-w-sm text-muted-foreground">
                Create your first project to start attracting contributors and
                sharing the upside.
              </p>
              <AppButton asChild className="mt-4">
                <Link href={newProjectUrl}>
                  <Plus className="mr-2 size-4" />
                  Create Your First Project
                </Link>
              </AppButton>
            </AppCardContent>
          </AppCard>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={routes.project.detail({ slug: project.slug })}
              >
                <AppCard className="h-full cursor-pointer transition-all hover:border-primary/50">
                  <AppCardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <AppCardTitle>{project.name}</AppCardTitle>
                        <AppCardDescription className="mt-1">
                          {project.tagline || 'No description'}
                        </AppCardDescription>
                      </div>
                      {project.rewardPool && (
                        <Badge variant="secondary">
                          {project.rewardPool.poolPercentage}% pool
                        </Badge>
                      )}
                    </div>
                  </AppCardHeader>
                  <AppCardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
                          <Target01 className="size-3.5 text-primary" />
                        </div>
                        <span>{project._count.bounties} bounties</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
                          <CoinsStacked01 className="size-3.5 text-primary" />
                        </div>
                        <span>{project._count.payouts} payouts</span>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Created{' '}
                        {new Date(project.createdAt).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          },
                        )}
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
                  </AppCardContent>
                </AppCard>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppBackground>
  )
}

function ProjectsSkeleton() {
  return (
    <AppBackground>
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
            <AppCard key={i}>
              <AppCardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="mt-1 h-4 w-48" />
              </AppCardHeader>
              <AppCardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </AppCardContent>
            </AppCard>
          ))}
        </div>
      </div>
    </AppBackground>
  )
}
