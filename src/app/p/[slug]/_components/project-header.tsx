'use client'

import {
  Calendar,
  CheckCircle,
  Clock,
  CoinsStacked01,
  Globe01,
  MessageSquare01,
  Plus,
  Settings01,
  Share07,
  ShieldTick,
  Target01,
  Users01,
} from '@untitled-ui/icons-react'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { GlassCard } from './glass-card'

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
    stats: {
      contributorCount: number
      totalPaidOutCents: number
      verifiedPayoutCount: number
    }
  }
  isFounder: boolean
}

function formatCurrency(cents: number): string {
  if (cents === 0) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function ProjectHeader({ project, isFounder }: ProjectHeaderProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = `${window.location.origin}/p/${project.slug}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const { stats } = project

  return (
    <div className="mb-6 space-y-4">
      {/* Breadcrumb-style header: user / project */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {/* Breadcrumb: {user icon} {username} / {app icon} {app name} */}
          <div className="flex items-center gap-1.5 text-sm sm:text-base">
            {/* Founder */}
            <Link
              href={routes.user.profile({ username: project.founder.name })}
              className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Avatar className="size-5 ring-1 ring-border">
                <AvatarImage src={project.founder.image ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {project.founder.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{project.founder.name}</span>
            </Link>

            {/* Separator */}
            <span className="text-muted-foreground/50">/</span>

            {/* Project */}
            <div className="flex items-center gap-1.5">
              {project.logoUrl ? (
                <Image
                  src={project.logoUrl}
                  alt={project.name}
                  width={20}
                  height={20}
                  className="size-5 rounded-sm object-cover ring-1 ring-border"
                />
              ) : (
                <div className="flex size-5 items-center justify-center rounded-sm bg-primary/10 text-xs font-bold text-primary ring-1 ring-border">
                  {project.name.charAt(0).toUpperCase()}
                </div>
              )}
              <h1 className="font-semibold text-foreground">{project.name}</h1>
            </div>
          </div>

          {/* Tagline */}
          {project.tagline && (
            <p className="max-w-xl text-sm text-muted-foreground">
              {project.tagline}
            </p>
          )}

          {/* Links row */}
          {(project.websiteUrl || project.discordUrl) && (
            <div className="flex items-center gap-2">
              {project.websiteUrl && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={project.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-sm border border-border bg-secondary px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Globe01 className="size-3" />
                        Website
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>Visit website</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {project.discordUrl && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={project.discordUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-sm border border-border bg-secondary px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <MessageSquare01 className="size-3" />
                        Discord
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>Join Discord</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="size-8 cursor-pointer border-border bg-secondary p-0 hover:bg-accent"
                  onClick={handleShare}
                >
                  {copied ? (
                    <CheckCircle className="size-3.5 text-green-500" />
                  ) : (
                    <Share07 className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {copied ? 'Copied!' : 'Share project'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {isFounder && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer border-border bg-secondary hover:bg-accent"
                >
                  <Settings01 className="mr-1.5 size-3.5" />
                  Manage
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href={routes.project.newBounty({ slug: project.slug })}>
                    <Plus className="mr-2 size-4" />
                    Create Bounty
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link
                    href={routes.project.submissions({ slug: project.slug })}
                  >
                    <Clock className="mr-2 size-4" />
                    Pending Submissions
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href={routes.project.newPayout({ slug: project.slug })}>
                    <CoinsStacked01 className="mr-2 size-4" />
                    Create Payout
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href={routes.project.settings({ slug: project.slug })}>
                    <Settings01 className="mr-2 size-4" />
                    Project Settings
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Stats bar - glass card with evenly spaced items */}
      {project.rewardPool && (
        <GlassCard className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:flex lg:items-center lg:justify-between">
          {/* Total Paid Out - Lead with this for trust */}
          <StatItem
            icon={CoinsStacked01}
            iconColor="text-green-500"
            iconBg="bg-green-500/10"
            value={formatCurrency(stats.totalPaidOutCents)}
            label="paid out"
          />

          {/* Contributors */}
          <StatItem
            icon={Users01}
            iconColor="text-purple-500"
            iconBg="bg-purple-500/10"
            value={stats.contributorCount.toString()}
            label={
              stats.contributorCount === 1 ? 'contributor' : 'contributors'
            }
          />

          {/* Verified Payouts */}
          <StatItem
            icon={ShieldTick}
            iconColor="text-blue-500"
            iconBg="bg-blue-500/10"
            value={stats.verifiedPayoutCount.toString()}
            label={
              stats.verifiedPayoutCount === 1
                ? 'verified payout'
                : 'verified payouts'
            }
          />

          {/* Reward Pool */}
          <StatItem
            icon={CoinsStacked01}
            iconColor="text-primary"
            iconBg="bg-primary/10"
            value={`${project.rewardPool.poolPercentage}%`}
            label={
              project.rewardPool.payoutFrequency === 'MONTHLY'
                ? 'monthly pool'
                : 'quarterly pool'
            }
          />

          {/* Open Bounties */}
          <StatItem
            icon={Target01}
            iconColor="text-orange-500"
            iconBg="bg-orange-500/10"
            value={project._count.bounties.toString()}
            label={project._count.bounties === 1 ? 'bounty' : 'bounties'}
          />

          {/* Commitment */}
          <StatItem
            icon={Calendar}
            iconColor="text-muted-foreground"
            iconBg="bg-foreground/5"
            value={new Date(
              project.rewardPool.commitmentEndsAt,
            ).toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            })}
            label="commitment"
          />
        </GlassCard>
      )}
    </div>
  )
}

function StatItem({
  icon: Icon,
  iconColor,
  iconBg,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  value: string
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex size-6 items-center justify-center rounded-sm ${iconBg}`}
      >
        <Icon className={`size-3.5 ${iconColor}`} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-semibold">{value}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}
