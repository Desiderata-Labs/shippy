'use client'

import {
  BankNote03,
  Calendar,
  ChevronRight,
  Target01,
  Users01,
  Wallet02,
} from '@untitled-ui/icons-react'
import Image from 'next/image'
import Link from 'next/link'
import { PoolType } from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
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
    poolType?: string | null
    poolPercentage: number | null
    payoutFrequency: string | null
    commitmentEndsAt: Date | string | null
    budgetCents?: bigint | number | null
    spentCents?: bigint | number | null
  } | null
  _count: {
    bounties: number
  }
}

export interface ProjectCardProps {
  project: ProjectCardProject
}

/**
 * Project card for grid views - balanced between compact and readable.
 */
export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={routes.project.detail({ slug: project.slug })}
      className="group block rounded-2xl border bg-accent shadow-md transition-all duration-300 hover:border-primary/75 hover:shadow-lg"
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
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-base font-bold">
              {project.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-medium">{project.name}</p>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {project.tagline || 'No description'}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-foreground">
          <span className="flex items-center gap-1">
            <Users01 className="size-3.5 opacity-50" />
            {project.founder.name || 'Unknown'}
          </span>
          <span className="flex items-center gap-1">
            <Target01 className="size-3.5 opacity-50" />
            <span
              className={cn(
                project._count.bounties > 0
                  ? 'text-primary'
                  : 'text-foreground',
              )}
            >
              {project._count.bounties}{' '}
              {project._count.bounties === 1 ? 'open bounty' : 'open bounties'}
            </span>
          </span>
          {project.rewardPool && (
            <PoolTypeDisplay rewardPool={project.rewardPool} />
          )}
        </div>
      </div>
    </Link>
  )
}

function formatCurrency(cents: number | bigint): string {
  const value = typeof cents === 'bigint' ? Number(cents) : cents
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100)
}

function PoolTypeDisplay({
  rewardPool,
}: {
  rewardPool: NonNullable<ProjectCardProject['rewardPool']>
}) {
  const poolType = rewardPool.poolType || PoolType.PROFIT_SHARE

  // PROFIT_SHARE pool type
  if (poolType === PoolType.PROFIT_SHARE && rewardPool.poolPercentage != null) {
    return (
      <>
        <span className="flex items-center gap-1 font-medium">
          <BankNote03 className="size-3.5 opacity-50" />
          {rewardPool.poolPercentage}% profit share
        </span>
        {rewardPool.payoutFrequency && (
          <span className="flex items-center gap-1">
            <Calendar className="size-3.5 opacity-50" />
            {rewardPool.payoutFrequency === 'MONTHLY' ? 'Monthly' : 'Quarterly'}
          </span>
        )}
      </>
    )
  }

  // FIXED_BUDGET pool type
  if (poolType === PoolType.FIXED_BUDGET && rewardPool.budgetCents != null) {
    const budget = Number(rewardPool.budgetCents)
    const spent = Number(rewardPool.spentCents || 0)
    const remaining = budget - spent
    const remainingPercent = budget > 0 ? Math.round((remaining / budget) * 100) : 0

    return (
      <span className="flex items-center gap-1 font-medium">
        <Wallet02 className="size-3.5 opacity-50" />
        {formatCurrency(budget)} budget ({remainingPercent}% left)
      </span>
    )
  }

  return null
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
