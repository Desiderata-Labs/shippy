'use client'

import {
  ArrowUpRight,
  BookOpen02,
  Calendar,
  CoinsStacked01,
  Globe01,
  HelpCircle,
  InfoCircle,
  MessageSquare01,
  PieChart01,
} from '@untitled-ui/icons-react'
import { cn } from '@/lib/utils'
import { GlassCard, GlassCardHeader } from './glass-card'

interface ReadmeTabProps {
  project: {
    name: string
    description: string | null
    discordUrl: string | null
    websiteUrl: string | null
    rewardPool: {
      poolPercentage: number
      payoutFrequency: string
      commitmentEndsAt: Date
    } | null
  }
}

export function ReadmeTab({ project }: ReadmeTabProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Main Content */}
      <div className="space-y-4 lg:col-span-2">
        {/* About */}
        <GlassCard className="p-4">
          <GlassCardHeader icon={BookOpen02} title={`About ${project.name}`} />
          <div className="mt-3">
            {project.description ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {project.description}
              </p>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <InfoCircle className="mb-2 size-6 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground italic">
                  No description provided yet.
                </p>
              </div>
            )}
          </div>
        </GlassCard>

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

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Links */}
        <GlassCard className="p-4">
          <h3 className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Links
          </h3>
          <div className="space-y-2">
            {project.websiteUrl && (
              <LinkButton
                href={project.websiteUrl}
                icon={Globe01}
                label="Website"
              />
            )}
            {project.discordUrl && (
              <LinkButton
                href={project.discordUrl}
                icon={MessageSquare01}
                label="Discord"
              />
            )}
            {!project.websiteUrl && !project.discordUrl && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No links added yet
              </p>
            )}
          </div>
        </GlassCard>

        {/* Pool Details */}
        {project.rewardPool && (
          <GlassCard className="p-4">
            <h3 className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Reward Pool
            </h3>
            <div className="space-y-3">
              <PoolDetail
                icon={PieChart01}
                label="Pool Size"
                value={`${project.rewardPool.poolPercentage}% of profit`}
                highlight
              />
              <PoolDetail
                icon={CoinsStacked01}
                label="Frequency"
                value={
                  project.rewardPool.payoutFrequency === 'MONTHLY'
                    ? 'Monthly'
                    : 'Quarterly'
                }
              />
              <PoolDetail
                icon={Calendar}
                label="Until"
                value={new Date(
                  project.rewardPool.commitmentEndsAt,
                ).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              />
            </div>

            {/* Visual pool indicator */}
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Pool allocation</span>
                <span className="font-medium text-primary">
                  {project.rewardPool.poolPercentage}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${project.rewardPool.poolPercentage}%` }}
                />
              </div>
            </div>
          </GlassCard>
        )}
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
      <div className="mb-2 flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {number}
      </div>
      <h4 className="text-sm font-medium">{title}</h4>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

function LinkButton({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group flex items-center justify-between rounded-sm border border-border bg-muted px-3 py-2',
        'transition-colors hover:bg-accent',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </a>
  )
}

function PoolDetail({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          'flex size-6 items-center justify-center rounded-sm',
          highlight ? 'bg-primary/10' : 'bg-muted',
        )}
      >
        <Icon
          className={cn(
            'size-3.5',
            highlight ? 'text-primary' : 'text-muted-foreground',
          )}
        />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className={cn('text-xs font-medium', highlight && 'text-primary')}>
          {value}
        </p>
      </div>
    </div>
  )
}
