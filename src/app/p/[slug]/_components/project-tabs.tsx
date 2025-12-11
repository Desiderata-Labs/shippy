'use client'

import {
  BookOpen02,
  CoinsStacked01,
  Target01,
  Users01,
} from '@untitled-ui/icons-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { BountiesTab } from './bounties-tab'
import { ContributorsTab } from './contributors-tab'
import { PayoutsTab } from './payouts-tab'
import { ReadmeTab } from './readme-tab'

interface ProjectTabsProps {
  project: {
    id: string
    slug: string
    name: string
    description: string | null
    discordUrl: string | null
    websiteUrl: string | null
    payoutVisibility: string
    rewardPool: {
      poolPercentage: number
      payoutFrequency: string
      commitmentEndsAt: Date
    } | null
    bounties: Array<{
      id: string
      title: string
      description: string
      points: number
      tags: string[]
      status: string
      claimMode: string
      evidenceDescription: string | null
      createdAt: Date
      _count: {
        claims: number
        submissions: number
        pendingSubmissions: number
      }
    }>
    stats: {
      verifiedPayoutCount: number
    }
  }
  isFounder: boolean
}

type TabValue = 'readme' | 'bounties' | 'contributors' | 'payouts'

interface TabItem {
  value: TabValue
  label: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
}

export function ProjectTabs({ project, isFounder }: ProjectTabsProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('readme')

  // Count active bounties (not COMPLETED or CLOSED)
  const activeBounties = project.bounties.filter(
    (b) => b.status === 'OPEN' || b.status === 'CLAIMED',
  )

  const tabs: TabItem[] = [
    {
      value: 'readme',
      label: 'Readme',
      icon: BookOpen02,
    },
    {
      value: 'bounties',
      label: 'Bounties',
      icon: Target01,
      // Show count if there are any active bounties
      count: activeBounties.length > 0 ? activeBounties.length : undefined,
    },
    {
      value: 'contributors',
      label: 'Contributors',
      icon: Users01,
    },
    {
      value: 'payouts',
      label: 'Payouts',
      icon: CoinsStacked01,
      // Show count of verified payouts
      count:
        project.stats.verifiedPayoutCount > 0
          ? project.stats.verifiedPayoutCount
          : undefined,
    },
  ]

  return (
    <div className="w-full">
      {/* GitHub-style tab navigation */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-0.5" aria-label="Project tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.value

            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'group relative flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="size-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-xs font-medium',
                      isActive
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground group-hover:bg-accent',
                    )}
                  >
                    {tab.count}
                  </span>
                )}

                {/* Active indicator */}
                {isActive && (
                  <span className="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="pt-4">
        {activeTab === 'readme' && <ReadmeTab project={project} />}
        {activeTab === 'bounties' && (
          <BountiesTab
            projectSlug={project.slug}
            bounties={project.bounties}
            isFounder={isFounder}
          />
        )}
        {activeTab === 'contributors' && (
          <ContributorsTab projectId={project.id} />
        )}
        {activeTab === 'payouts' && (
          <PayoutsTab
            projectId={project.id}
            projectSlug={project.slug}
            isFounder={isFounder}
            payoutVisibility={project.payoutVisibility}
          />
        )}
      </div>
    </div>
  )
}
