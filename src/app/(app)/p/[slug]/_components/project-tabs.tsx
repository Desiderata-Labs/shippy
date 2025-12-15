'use client'

import {
  BankNote03,
  BookOpen02,
  Target01,
  Users01,
} from '@untitled-ui/icons-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { DEFAULT_PROJECT_TAB, ProjectTab, routes } from '@/lib/routes'
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
    projectKey: string
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
      number: number
      title: string
      description: string
      points: number | null
      labels: Array<{
        label: {
          id: string
          name: string
          color: string
        }
      }>
      status: string
      claimMode: string
      evidenceDescription: string | null
      createdAt: Date
      claims: Array<{
        id: string
        expiresAt: Date
        user: {
          id: string
          name: string
          image: string | null
        }
      }>
      approvedSubmission: Array<{
        user: {
          id: string
          name: string
          image: string | null
        }
      }>
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

interface TabItem {
  value: ProjectTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
}

function isValidTab(tab: string | null): tab is ProjectTab {
  return tab !== null && Object.values(ProjectTab).includes(tab as ProjectTab)
}

export function ProjectTabs({ project, isFounder }: ProjectTabsProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab = isValidTab(tabParam) ? tabParam : DEFAULT_PROJECT_TAB

  // Count active bounties (not COMPLETED or CLOSED)
  const activeBounties = project.bounties.filter(
    (b) => b.status === 'OPEN' || b.status === 'CLAIMED',
  )

  const tabs: TabItem[] = [
    {
      value: ProjectTab.BOUNTIES,
      label: 'Bounties',
      icon: Target01,
      // Show count if there are any active bounties
      count: activeBounties.length > 0 ? activeBounties.length : undefined,
    },
    {
      value: ProjectTab.PAYOUTS,
      label: 'Payouts',
      icon: BankNote03,
      // Show count of verified payouts
      count:
        project.stats.verifiedPayoutCount > 0
          ? project.stats.verifiedPayoutCount
          : undefined,
    },
    {
      value: ProjectTab.CONTRIBUTORS,
      label: 'Contributors',
      icon: Users01,
    },
    {
      value: ProjectTab.README,
      label: 'Readme',
      icon: BookOpen02,
    },
  ]

  return (
    <div className="w-full">
      {/* GitHub-style tab navigation - scrollable on mobile */}
      <div className="border-b border-border">
        <nav
          className="scrollbar-hide -mb-px flex gap-0.5 overflow-x-auto"
          aria-label="Project tabs"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.value
            const href = routes.project.detail({
              slug: project.slug,
              tab: tab.value,
            })

            return (
              <Link
                key={tab.value}
                href={href}
                scroll={false}
                className={cn(
                  'group relative flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors sm:gap-2 sm:px-4',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="size-4" />
                {/* Hide labels on mobile, show on sm+ */}
                <span className="hidden sm:inline">{tab.label}</span>
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
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="pt-4">
        {activeTab === ProjectTab.README && <ReadmeTab project={project} />}
        {activeTab === ProjectTab.BOUNTIES && (
          <BountiesTab
            projectSlug={project.slug}
            projectKey={project.projectKey}
            bounties={project.bounties}
            isFounder={isFounder}
          />
        )}
        {activeTab === ProjectTab.CONTRIBUTORS && (
          <ContributorsTab projectId={project.id} />
        )}
        {activeTab === ProjectTab.PAYOUTS && (
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
