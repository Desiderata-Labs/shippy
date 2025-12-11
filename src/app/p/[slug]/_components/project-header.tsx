import {
  Calendar,
  CoinsStacked01,
  Globe01,
  Settings01,
} from '@untitled-ui/icons-react'
import Image from 'next/image'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

interface ProjectHeaderProps {
  project: {
    id: string
    slug: string
    name: string
    tagline: string | null
    logoUrl: string | null
    websiteUrl: string | null
    discordUrl: string | null
    founder: {
      id: string
      name: string
      image: string | null
    }
    rewardPool: {
      poolPercentage: number
      payoutFrequency: string
      commitmentEndsAt: Date
    } | null
    _count: {
      bounties: number
      payouts: number
    }
  }
  isFounder: boolean
}

export function ProjectHeader({ project, isFounder }: ProjectHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {project.logoUrl ? (
            <Image
              src={project.logoUrl}
              alt={project.name}
              width={64}
              height={64}
              className="size-16 rounded-xl object-cover"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-xl bg-primary/10 text-2xl font-bold text-primary">
              {project.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{project.name}</h1>
            {project.tagline && (
              <p className="mt-1 text-muted-foreground">{project.tagline}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm">
                <Avatar className="size-5">
                  <AvatarImage src={project.founder.image ?? undefined} />
                  <AvatarFallback>
                    {project.founder.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground">
                  by {project.founder.name}
                </span>
              </div>
              {project.websiteUrl && (
                <a
                  href={project.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Globe01 className="size-4" />
                  Website
                </a>
              )}
            </div>
          </div>
        </div>

        {isFounder && (
          <Button variant="outline" asChild className="cursor-pointer">
            <Link href={routes.project.settings({ slug: project.slug })}>
              <Settings01 className="mr-2 size-4" />
              Manage Project
            </Link>
          </Button>
        )}
      </div>

      {/* Stats */}
      {project.rewardPool && (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-lg border border-border/50 bg-gradient-to-r from-primary/5 to-transparent p-4">
          <div className="flex items-center gap-2">
            <CoinsStacked01 className="size-5 text-primary" />
            <div>
              <p className="text-sm font-medium">
                {project.rewardPool.poolPercentage}% Reward Pool
              </p>
              <p className="text-xs text-muted-foreground">
                of{' '}
                {project.rewardPool.payoutFrequency === 'MONTHLY'
                  ? 'monthly'
                  : 'quarterly'}{' '}
                profit
              </p>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Calendar className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                Pool runs through{' '}
                {new Date(
                  project.rewardPool.commitmentEndsAt,
                ).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <p className="text-xs text-muted-foreground">Commitment period</p>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-sm font-medium">
              {project._count.bounties} bounties
            </p>
            <p className="text-xs text-muted-foreground">
              {project._count.payouts} payouts made
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
