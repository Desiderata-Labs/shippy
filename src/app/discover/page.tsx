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

function ProjectCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Skeleton className="size-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function DiscoverPage() {
  const { data, isLoading, error } = trpc.project.discover.useQuery({
    limit: 20,
    sortBy: 'newest',
  })

  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Discover Projects</h1>
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
          <Button
            variant="outline"
            className="mt-4 cursor-pointer"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      ) : data?.projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target01 className="mb-4 size-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No projects yet</h2>
          <p className="mt-2 text-muted-foreground">
            Be the first to create a project and attract contributors!
          </p>
          <Button asChild className="mt-4 cursor-pointer">
            <Link href="/founder/new">Create Project</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data?.projects.map((project) => (
            <Link key={project.id} href={`/project/${project.slug}`}>
              <Card className="h-full cursor-pointer transition-colors hover:border-primary/50">
                <CardHeader>
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
                      <CardTitle className="truncate text-lg">
                        {project.name}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {project.tagline || 'No description'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {data?.nextCursor && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" className="cursor-pointer">
            <Loader2 className="mr-2 size-4" />
            Load More
          </Button>
        </div>
      )}
    </div>
  )
}
