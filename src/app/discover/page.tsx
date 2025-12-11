'use client'

import { trpc } from '@/lib/trpc/react'
import {
  Calendar,
  CoinsStacked01,
  Target01,
  Users01,
} from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
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

function ProjectCardSkeleton() {
  return (
    <AppCard>
      <AppCardHeader>
        <div className="flex items-start gap-3">
          <Skeleton className="size-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </AppCardHeader>
      <AppCardContent>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      </AppCardContent>
    </AppCard>
  )
}

export default function DiscoverPage() {
  const { data, isLoading, error } = trpc.project.discover.useQuery({
    limit: 20,
    sortBy: 'newest',
  })

  return (
    <AppBackground>
      <div className="container px-4 py-8">
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
              <Link
                key={project.id}
                href={routes.project.detail({ slug: project.slug })}
              >
                <AppCard className="h-full cursor-pointer transition-all hover:border-primary/50">
                  <AppCardHeader>
                    <div className="flex items-start gap-3">
                      {project.logoUrl ? (
                        <Image
                          src={project.logoUrl}
                          alt={project.name}
                          width={48}
                          height={48}
                          className="size-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
                          {project.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <AppCardTitle className="truncate text-lg">
                          {project.name}
                        </AppCardTitle>
                        <AppCardDescription className="line-clamp-2">
                          {project.tagline || 'No description'}
                        </AppCardDescription>
                      </div>
                    </div>
                  </AppCardHeader>
                  <AppCardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <CoinsStacked01 className="size-4 text-muted-foreground" />
                        <span>
                          {project.rewardPool
                            ? `${project.rewardPool.poolPercentage}% pool`
                            : 'No pool'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Target01 className="size-4 text-muted-foreground" />
                        <span>{project._count.bounties} bounties</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users01 className="size-4 text-muted-foreground" />
                        <span>By {project.founder.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="size-4 text-muted-foreground" />
                        <span>
                          {project.rewardPool?.payoutFrequency === 'MONTHLY'
                            ? 'Monthly'
                            : 'Quarterly'}
                        </span>
                      </div>
                    </div>
                    {project.rewardPool && (
                      <div className="mt-4 flex items-center gap-2">
                        <Badge variant="secondary">
                          Pool ends{' '}
                          {new Date(
                            project.rewardPool.commitmentEndsAt,
                          ).toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Badge>
                      </div>
                    )}
                  </AppCardContent>
                </AppCard>
              </Link>
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
