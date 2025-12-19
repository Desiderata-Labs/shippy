'use client'

import { InfoCircle } from '@untitled-ui/icons-react'
import { PoolType } from '@/lib/db/types'
import { Markdown } from '@/components/ui/markdown'

interface ReadmeTabProps {
  project: {
    name: string
    description: string | null
    rewardPool: {
      poolType?: string | null
      poolPercentage: number | null
      payoutFrequency: string | null
      commitmentEndsAt: Date | null
      budgetCents?: bigint | number | null
    } | null
  }
}

export function ReadmeTab({ project }: ReadmeTabProps) {
  return (
    <div className="space-y-6">
      {project.description ? (
        <Markdown
          className="px-4"
          markdown={project.description}
          proseSize="sm"
        />
      ) : (
        <div className="flex items-center gap-2 py-4 text-muted-foreground">
          <InfoCircle className="size-4" />
          <p className="text-sm italic">No description provided yet.</p>
        </div>
      )}

      {/* How It Works (if reward pool exists) */}
      {project.rewardPool && (
        <HowToEarnSection poolType={project.rewardPool.poolType || PoolType.PROFIT_SHARE} />
      )}
    </div>
  )
}

function HowToEarnSection({ poolType }: { poolType: string }) {
  // Pool-type-specific content
  const content: Record<string, { subtitle: string; step3: { title: string; description: string } }> = {
    [PoolType.PROFIT_SHARE]: {
      subtitle: 'Complete bounties, earn points, get paid',
      step3: {
        title: 'Get paid',
        description: 'Earn recurring payouts from points',
      },
    },
    [PoolType.FIXED_BUDGET]: {
      subtitle: 'Complete bounties and earn from the reward pool',
      step3: {
        title: 'Get paid',
        description: 'Earn your share from the budget pool',
      },
    },
  }

  const { subtitle, step3 } = content[poolType] ?? content[PoolType.PROFIT_SHARE]

  return (
    <div className="mt-10 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-lg font-semibold">How to Earn</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
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
          title={step3.title}
          description={step3.description}
        />
      </div>
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
