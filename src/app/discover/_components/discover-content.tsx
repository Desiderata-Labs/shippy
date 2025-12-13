'use client'

import { trpc } from '@/lib/trpc/react'
import { Target01 } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import { AppButton } from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import {
  ProjectCard,
  ProjectCardSkeleton,
} from '@/components/project/project-card'

export function DiscoverContent() {
  const { data, isLoading, error } = trpc.project.discover.useQuery({
    limit: 20,
    sortBy: 'newest',
  })

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Discover Projects
          </h1>
          <p className="mt-2 text-muted-foreground">
            Find projects looking for contributors. Ship work, earn royalties.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">
              Failed to load projects. Please try again.
            </p>
            <AppButton
              variant="outline"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Retry
            </AppButton>
          </div>
        ) : data?.projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <Target01 className="size-6 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">No projects yet</h2>
            <p className="mt-2 text-muted-foreground">
              Be the first to create a project and attract contributors!
            </p>
            <AppButton asChild className="mt-4">
              <Link href={routes.auth.signUp()}>Create Project</Link>
            </AppButton>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data?.projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {data?.nextCursor && (
          <div className="mt-8 flex justify-center">
            <AppButton variant="outline">
              <Loader2 className="mr-2 size-4" />
              Load More
            </AppButton>
          </div>
        )}
      </div>
    </AppBackground>
  )
}
