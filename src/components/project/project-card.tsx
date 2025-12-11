'use client'

import {
  ArrowRight,
  Calendar,
  CoinsStacked01,
  Target01,
  Users01,
} from '@untitled-ui/icons-react'
import Image from 'next/image'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import {
  AppCard,
  AppCardContent,
  AppCardDescription,
  AppCardHeader,
  AppCardTitle,
} from '@/components/app'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export interface ProjectCardProject {
  id: string
  slug: string
  name: string
  tagline: string | null
  logoUrl: string | null
  founder: {
    id: string
    name: string | null
  }
  rewardPool: {
    poolPercentage: number
    payoutFrequency: string
    commitmentEndsAt: Date | string
  } | null
  _count: {
    bounties: number
  }
}

export interface ProjectCardProps {
  project: ProjectCardProject
  showManageButton?: boolean
}

export function ProjectCard({ project, showManageButton }: ProjectCardProps) {
  return (
    <Link href={routes.project.detail({ slug: project.slug })}>
      <AppCard className="h-full cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:ring-primary!">
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
              <span>By {project.founder.name || 'Unknown'}</span>
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
          <div className="mt-4 flex h-8 items-center justify-between">
            {project.rewardPool && (
              <Badge variant="secondary">
                Pool ends{' '}
                {new Date(
                  project.rewardPool.commitmentEndsAt,
                ).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </Badge>
            )}
            {showManageButton && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto cursor-pointer"
              >
                Manage
                <ArrowRight className="ml-1 size-4" />
              </Button>
            )}
          </div>
        </AppCardContent>
      </AppCard>
    </Link>
  )
}

export function ProjectCardSkeleton() {
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
