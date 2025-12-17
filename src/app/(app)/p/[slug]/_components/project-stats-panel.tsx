'use client'

import { useSession } from '@/lib/auth/react'
import {
  BankNote03,
  Calendar,
  Link03,
  Lock01,
  MessageSquare01,
  PieChart01,
  ShieldTick,
  Users01,
} from '@untitled-ui/icons-react'
import { PayoutVisibility } from '@/lib/db/types'
import { Separator } from '@/components/ui/separator'

interface ProjectStatsPanelProps {
  project: {
    founderId: string
    tagline: string | null
    websiteUrl: string | null
    discordUrl: string | null
    payoutVisibility: PayoutVisibility
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

function formatCommitmentDate(date: Date): string {
  const endDate = new Date(date)
  const now = new Date()
  const yearsFromNow =
    (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365)

  // If more than 100 years away, show "Forever"
  if (yearsFromNow > 100) {
    return 'Forever'
  }

  return endDate.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

export function ProjectStatsPanel({ project }: ProjectStatsPanelProps) {
  const { data: session } = useSession()
  const {
    founderId,
    stats,
    rewardPool,
    tagline,
    websiteUrl,
    discordUrl,
    payoutVisibility,
  } = project

  const isFounder = session?.user?.id === founderId
  const hasLinks = websiteUrl || discordUrl
  const isPayoutPrivate = payoutVisibility === PayoutVisibility.PRIVATE
  const showPrivateToOthers = isPayoutPrivate && !isFounder
  const showPrivateLock = isPayoutPrivate && isFounder

  if (!rewardPool) return null

  return (
    <div className="mt-2.5 space-y-4">
      {/* About section - GitHub style */}
      {(tagline || hasLinks) && (
        <>
          <span className="block text-sm font-semibold text-muted-foreground">
            About
          </span>

          {tagline && <p className="text-sm leading-relaxed">{tagline}</p>}

          {/* Links */}
          {hasLinks && (
            <div className="space-y-1.5">
              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm"
                >
                  <Link03 className="size-3.5 shrink-0 opacity-50" />
                  <span className="truncate">{formatUrl(websiteUrl)}</span>
                </a>
              )}
              {discordUrl && (
                <a
                  href={discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm"
                >
                  <MessageSquare01 className="size-3.5 shrink-0 opacity-50" />
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
        icon={BankNote03}
        label="Paid out"
        value={
          showPrivateToOthers
            ? 'Private'
            : formatCurrency(stats.totalPaidOutCents)
        }
        showPrivateLock={showPrivateLock}
      />

      <div className="pl-5.5">
        <Separator />
      </div>

      {/* Contributors */}
      <StatItem
        icon={Users01}
        label={stats.contributorCount === 1 ? 'Contributor' : 'Contributors'}
        value={stats.contributorCount.toString()}
      />

      {/* Verified Payouts */}
      <StatItem
        icon={ShieldTick}
        label="Verified payouts"
        value={stats.verifiedPayoutCount.toString()}
      />

      <div className="pl-5.5">
        <Separator />
      </div>

      {/* Profit Share */}
      <StatItem
        icon={PieChart01}
        label="Profit share"
        value={`${rewardPool.poolPercentage}%`}
      />

      {/* Commitment - suppressHydrationWarning since it compares with current date */}
      <StatItem
        icon={Calendar}
        label="Commitment"
        value={formatCommitmentDate(rewardPool.commitmentEndsAt)}
        suppressHydrationWarning
      />
    </div>
  )
}

function StatItem({
  icon: Icon,
  label,
  value,
  showPrivateLock,
  suppressHydrationWarning = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  showPrivateLock?: boolean
  suppressHydrationWarning?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-foreground opacity-50" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {showPrivateLock && (
          <span title="Hidden from others">
            <Lock01 className="size-3 opacity-50" />
          </span>
        )}
        <span
          className="text-xs font-semibold"
          suppressHydrationWarning={suppressHydrationWarning}
        >
          {value}
        </span>
      </div>
    </div>
  )
}
