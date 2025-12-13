'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { Folder, Plus, User01 } from '@untitled-ui/icons-react'
import Link from 'next/link'
import { notFound, useParams } from 'next/navigation'
import { routes } from '@/lib/routes'
import { AppButton } from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import {
  ProjectCard,
  ProjectCardSkeleton,
} from '@/components/project/project-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { GlassCard } from '@/app/(app)/p/[slug]/_components/glass-card'

export function UserProfileContent() {
  const params = useParams<{ username: string }>()
  const { data: session, isPending: sessionLoading } = useSession()

  // Check if viewing own profile
  const currentUsername = (session?.user as { username?: string })?.username
  const isOwnProfile = currentUsername === params.username

  // For own profile, use myProjects (all projects)
  // For other users, use getPublicProjects (public only)
  const {
    data: myProjects,
    isLoading: myProjectsLoading,
    error: myProjectsError,
  } = trpc.project.myProjects.useQuery(undefined, {
    enabled: !!session && isOwnProfile,
  })

  const {
    data: publicProjects,
    isLoading: publicProjectsLoading,
    error: publicProjectsError,
  } = trpc.user.getPublicProjects.useQuery(
    { username: params.username },
    { enabled: !isOwnProfile },
  )

  const {
    data: profileUser,
    isLoading: profileUserLoading,
    error: profileUserError,
  } = trpc.user.getByUsername.useQuery(
    { username: params.username },
    { enabled: !isOwnProfile },
  )

  // Show loading state
  if (sessionLoading) {
    return <ProfileSkeleton />
  }

  // Determine which data to use
  const projects = isOwnProfile ? myProjects : publicProjects
  const isLoading = isOwnProfile ? myProjectsLoading : publicProjectsLoading
  const error = isOwnProfile ? myProjectsError : publicProjectsError

  // Handle user not found for public profiles
  if (!isOwnProfile && profileUserError?.data?.code === 'NOT_FOUND') {
    notFound()
  }

  if (isLoading || (!isOwnProfile && profileUserLoading)) {
    return <ProfileSkeleton />
  }

  // Handle errors
  if (error || (!isOwnProfile && profileUserError)) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          <GlassCard className="py-12 text-center">
            <p className="text-muted-foreground">
              Something went wrong loading this profile.
            </p>
          </GlassCard>
        </div>
      </AppBackground>
    )
  }

  // Get user display info - from session for own profile, from query for others
  const displayName = isOwnProfile ? session?.user.name : profileUser?.name
  const displayImage = isOwnProfile ? session?.user.image : profileUser?.image

  const newProjectUrl = currentUsername
    ? routes.user.newProject({ username: currentUsername })
    : null

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarImage src={displayImage ?? undefined} />
              <AvatarFallback className="bg-muted">
                {displayName
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase() ?? <User01 className="size-5" />}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {displayName ?? params.username}
              </h1>
              <p className="text-xs text-muted-foreground">
                @{params.username}
              </p>
            </div>
          </div>
          {isOwnProfile && newProjectUrl && (
            <AppButton asChild size="sm">
              <Link href={newProjectUrl}>
                <Plus className="mr-1.5 size-4" />
                New Project
              </Link>
            </AppButton>
          )}
        </div>

        {!projects || projects.length === 0 ? (
          <GlassCard className="py-12 text-center">
            <div className="mx-auto flex max-w-xs flex-col items-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <Folder className="size-6 text-primary" />
              </div>
              {isOwnProfile ? (
                <>
                  <h3 className="text-base font-semibold">No projects yet</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Create your first project to start attracting contributors
                    and sharing the upside.
                  </p>
                  {newProjectUrl && (
                    <AppButton asChild className="mt-4" size="sm">
                      <Link href={newProjectUrl}>
                        <Plus className="mr-1.5 size-4" />
                        Create Your First Project
                      </Link>
                    </AppButton>
                  )}
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold">
                    No public projects
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    This user hasn&apos;t created any public projects yet.
                  </p>
                </>
              )}
            </div>
          </GlassCard>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </AppBackground>
  )
}

function ProfileSkeleton() {
  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div>
              <Skeleton className="h-7 w-36" />
              <Skeleton className="mt-1 h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </AppBackground>
  )
}
