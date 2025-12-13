'use client'

import {
  Calendar,
  CoinsStacked01,
  Link03,
  MessageSquare01,
  ShieldTick,
  Target01,
  Users01,
} from '@untitled-ui/icons-react'
import { Separator } from '@/components/ui/separator'

interface ProjectStatsPanelProps {
  project: {
    tagline: string | null
    websiteUrl: string | null
    discordUrl: string | null
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

function formatUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function ProjectStatsPanel({ project }: ProjectStatsPanelProps) {
  const { stats, rewardPool, _count, tagline, websiteUrl, discordUrl } = project

  const hasLinks = websiteUrl || discordUrl

  if (!rewardPool) return null

  return (
    <div className="mt-2.5 space-y-4">
      {/* About section - GitHub style */}
      {(tagline || hasLinks) && (
        <>
          <span className="block text-sm font-semibold text-muted-foreground">
            About
          </span>

          {tagline && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {tagline}
            </p>
          )}

          {/* Links */}
          {hasLinks && (
            <div className="space-y-1.5">
              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary transition-colors hover:underline"
                >
                  <Link03 className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{formatUrl(websiteUrl)}</span>
                </a>
              )}
              {discordUrl && (
                <a
                  href={discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <MessageSquare01 className="size-3.5 shrink-0" />
                  <span className="truncate">{formatUrl(discordUrl)}</span>
                </a>
              )}
            </div>
          )}

          <Separator />
        </>
      )}

      <span className="block text-sm font-semibold text-muted-foreground">
        Stats
      </span>

      {/* Total Paid Out - Lead with this for trust */}
      <StatItem
        icon={CoinsStacked01}
        iconColor="text-green-500"
        label="Paid out"
        value={formatCurrency(stats.totalPaidOutCents)}
      />

      <div className="pl-5.5">
        <Separator />
      </div>

      {/* Contributors */}
      <StatItem
        icon={Users01}
        iconColor="text-purple-500"
        label={stats.contributorCount === 1 ? 'Contributor' : 'Contributors'}
        value={stats.contributorCount.toString()}
      />

      {/* Verified Payouts */}
      <StatItem
        icon={ShieldTick}
        iconColor="text-blue-500"
        label="Verified payouts"
        value={stats.verifiedPayoutCount.toString()}
      />

      <div className="pl-5.5">
        <Separator />
      </div>

      {/* Reward Pool */}
      <StatItem
        icon={CoinsStacked01}
        iconColor="text-primary"
        label={
          rewardPool.payoutFrequency === 'MONTHLY'
            ? 'Monthly pool'
            : 'Quarterly pool'
        }
        value={`${rewardPool.poolPercentage}%`}
      />

      {/* Open Bounties */}
      <StatItem
        icon={Target01}
        iconColor="text-orange-500"
        label={_count.bounties === 1 ? 'Bounty' : 'Bounties'}
        value={_count.bounties.toString()}
      />

      {/* Commitment */}
      <StatItem
        icon={Calendar}
        iconColor="text-muted-foreground"
        label="Commitment"
        value={new Date(rewardPool.commitmentEndsAt).toLocaleDateString(
          'en-US',
          {
            month: 'short',
            year: 'numeric',
          },
        )}
      />
    </div>
  )
}

function StatItem({
  icon: Icon,
  iconColor,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={`size-3.5 ${iconColor}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-xs font-semibold">{value}</span>
    </div>
  )
}
