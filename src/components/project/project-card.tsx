'use client'

import {
  Calendar,
  ChevronRight,
  CoinsStacked01,
  Target01,
  Users01,
} from '@untitled-ui/icons-react'
import Image from 'next/image'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import { Badge } from '@/components/ui/badge'
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

/**
 * Project card for grid views - balanced between compact and readable.
 */
export function ProjectCard({ project, showManageButton }: ProjectCardProps) {
  return (
    <Link
      href={routes.project.detail({ slug: project.slug })}
      className="group block rounded-lg border border-border bg-card transition-colors hover:bg-muted/50"
    >
      <div className="p-4">
        {/* Header with logo and title */}
        <div className="flex items-start gap-3">
          {project.logoUrl ? (
            <Image
              src={project.logoUrl}
              alt={project.name}
              width={44}
              height={44}
              className="size-11 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base font-bold text-primary">
              {project.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-medium transition-colors group-hover:text-primary">
                {project.name}
              </p>
              {showManageButton ? (
                <Badge
                  variant="outline"
                  className="shrink-0 border-primary/20 bg-primary/5 text-xs text-primary"
                >
                  Manage
                </Badge>
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              )}
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {project.tagline || 'No description'}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users01 className="size-3.5" />
            {project.founder.name || 'Unknown'}
          </span>
          <span className="flex items-center gap-1">
            <Target01 className="size-3.5" />
            {project._count.bounties}{' '}
            {project._count.bounties === 1 ? 'bounty' : 'bounties'}
          </span>
          {project.rewardPool && (
            <>
              <span className="flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
                <CoinsStacked01 className="size-3.5" />
                {project.rewardPool.poolPercentage}% pool
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" />
                {project.rewardPool.payoutFrequency === 'MONTHLY'
                  ? 'Monthly'
                  : 'Quarterly'}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

export function ProjectCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
      <div className="mt-3 flex gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  )
}
