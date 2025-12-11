'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { Plus, Target01 } from '@untitled-ui/icons-react'
import Link from 'next/link'
import { redirect, useParams } from 'next/navigation'
import { routes } from '@/lib/routes'
import { AppButton, AppCard, AppCardContent } from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import {
  ProjectCard,
  ProjectCardSkeleton,
} from '@/components/project/project-card'
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
              <ProjectCard
                key={project.id}
                project={project}
                showManageButton
              />
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
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </AppBackground>
  )
}
