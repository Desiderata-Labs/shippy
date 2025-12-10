'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BountiesTab } from './bounties-tab'
import { ContributorsTab } from './contributors-tab'
import { ReadmeTab } from './readme-tab'

interface ProjectTabsProps {
  project: {
    id: string
    slug: string
    name: string
    description: string | null
    discordUrl: string | null
    websiteUrl: string | null
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
      }
    }>
  }
  isFounder: boolean
}

export function ProjectTabs({ project, isFounder }: ProjectTabsProps) {
  const openBounties = project.bounties.filter((b) => b.status === 'OPEN')

  return (
    <Tabs defaultValue="readme" className="w-full">
      <TabsList className="mb-6 w-full justify-start">
        <TabsTrigger value="readme" className="cursor-pointer">
          Readme
        </TabsTrigger>
        <TabsTrigger value="bounties" className="cursor-pointer">
          Bounties
          {openBounties.length > 0 && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {openBounties.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="contributors" className="cursor-pointer">
          Contributors
        </TabsTrigger>
      </TabsList>

      <TabsContent value="readme">
        <ReadmeTab project={project} />
      </TabsContent>

      <TabsContent value="bounties">
        <BountiesTab
          projectId={project.id}
          bounties={project.bounties}
          isFounder={isFounder}
        />
      </TabsContent>

      <TabsContent value="contributors">
        <ContributorsTab projectId={project.id} />
      </TabsContent>
    </Tabs>
  )
}
