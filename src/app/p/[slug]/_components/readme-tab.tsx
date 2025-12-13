'use client'

import { HelpCircle, InfoCircle } from '@untitled-ui/icons-react'
import { Markdown } from '@/components/ui/markdown'
import { GlassCard, GlassCardHeader } from './glass-card'

interface ReadmeTabProps {
  project: {
    name: string
    description: string | null
    rewardPool: {
      poolPercentage: number
      payoutFrequency: string
      commitmentEndsAt: Date
    } | null
  }
}

export function ReadmeTab({ project }: ReadmeTabProps) {
  return (
    <div className="space-y-6">
      {project.description ? (
        <Markdown markdown={project.description} proseSize="sm" />
      ) : (
        <div className="flex items-center gap-2 py-4 text-muted-foreground">
          <InfoCircle className="size-4" />
          <p className="text-sm italic">No description provided yet.</p>
        </div>
      )}

      {/* How It Works (if reward pool exists) */}
      {project.rewardPool && (
        <GlassCard className="p-4">
          <GlassCardHeader
            icon={HelpCircle}
            title="How to Earn"
            description="Complete bounties, earn points, get paid"
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StepCard
              number={1}
              title="Claim a bounty"
              description="Find work that matches your skills"
            />
            <StepCard
              number={2}
              title="Ship the work"
              description="Complete the task and submit proof"
            />
            <StepCard
              number={3}
              title="Get paid"
              description="Earn recurring payouts from points"
            />
          </div>
        </GlassCard>
      )}
    </div>
  )
}

function StepCard({
  number,
  title,
  description,
}: {
  number: number
  title: string
  description: string
}) {
  return (
    <div className="relative rounded-lg border border-border bg-muted p-3">
      <div className="mb-2 flex size-6 items-center justify-center rounded-full bg-card text-xs font-bold">
        {number}
      </div>
      <h4 className="text-sm font-medium">{title}</h4>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
