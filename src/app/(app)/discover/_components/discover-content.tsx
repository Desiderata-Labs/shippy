'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { SearchLg } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { AppButton } from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import {
  ProjectCard,
  ProjectCardSkeleton,
} from '@/components/project/project-card'
import { Card } from '@/components/ui/card'

type SortOption = 'newest' | 'mostBounties'

export function DiscoverContent() {
  const [sortBy, setSortBy] = useState<SortOption>('mostBounties')
  const { data: session } = useSession()

  const username = (session?.user as { username?: string })?.username
  const createProjectUrl = username
    ? routes.user.newProject({ username })
    : routes.auth.signUp()

  const { data, isLoading, error } = trpc.project.discover.useQuery({
    limit: 20,
    sortBy,
  })

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Discover Projects
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Find projects looking for contributors. Ship work, earn royalties.
          </p>
        </div>

        {/* Sort filters */}
        <div className="mb-4 flex items-center gap-1">
          <SortButton
            active={sortBy === 'mostBounties'}
            onClick={() => setSortBy('mostBounties')}
          >
            Most Bounties
          </SortButton>
          <SortButton
            active={sortBy === 'newest'}
            onClick={() => setSortBy('newest')}
          >
            Newest
          </SortButton>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <Card className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Failed to load projects. Please try again.
            </p>
            <AppButton
              variant="outline"
              className="mt-4"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Retry
            </AppButton>
          </Card>
        ) : data?.projects.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto flex max-w-xs flex-col items-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
                <SearchLg className="size-6 opacity-50" />
              </div>
              <h3 className="text-base font-semibold">No projects yet</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Be the first to create a project and attract contributors!
              </p>
              <AppButton asChild className="mt-4" size="sm">
                <Link href={createProjectUrl}>Create Project</Link>
              </AppButton>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data?.projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {data?.nextCursor && (
          <div className="mt-6 flex justify-center">
            <AppButton variant="outline" size="sm">
              <Loader2 className="mr-2 size-3" />
              Load More
            </AppButton>
          </div>
        )}
      </div>
    </AppBackground>
  )
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
