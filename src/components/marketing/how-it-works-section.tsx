'use client'

import {
  BankNote03,
  CheckCircle,
  ClipboardCheck,
  Target01,
} from '@untitled-ui/icons-react'
import { ParticleBackground, ParticleIntensity } from './particle-background'

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden py-24 md:py-32"
    >
      <ParticleBackground intensity={ParticleIntensity.Subtle} />
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
            <span className="text-primary">✦</span>
            From task to payout
          </div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            No vesting schedules. Just ship work and get paid.
          </p>
        </div>

        {/* Steps - 2x2 grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Step 1: Post bounties */}
          <GlassCard>
            <StepNumber>01</StepNumber>
            <CardHeader icon={Target01} title="Post bounties" />
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Create specific tasks with point rewards. Each point = 0.1% of
              your reward pool. Only pay for work that gets done.
            </p>
            <div className="flex flex-col gap-2">
              <BountyRow title="SEO blog post" points={50} />
              <BountyRow title="Product video" points={100} dimmed />
              <BountyRow title="Landing page copy" points={30} dimmed />
            </div>
          </GlassCard>

          {/* Step 2: Ship work */}
          <GlassCard>
            <StepNumber>02</StepNumber>
            <CardHeader icon={ClipboardCheck} title="Ship work" />
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Contributors claim bounties, deliver proof of work, and earn
              points when approved.
            </p>
            <div className="flex flex-col gap-2">
              <ListItem
                icon={<CheckCircle className="size-3.5" />}
                iconBg="bg-primary/10"
                iconColor="text-primary"
              >
                <span className="text-sm">SEO blog post</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  by Sarah M.
                </span>
                <span className="ml-auto text-sm font-medium text-primary">
                  +50 pts
                </span>
              </ListItem>
              <ListItem
                icon={<ClipboardCheck className="size-3.5" />}
                iconBg="bg-yellow-500/10"
                iconColor="text-yellow-400"
                dimmed
              >
                <span className="text-sm">Product video</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  in review
                </span>
              </ListItem>
            </div>
          </GlassCard>

          {/* Step 3: Split profits */}
          <GlassCard>
            <StepNumber>03</StepNumber>
            <CardHeader icon={BankNote03} title="Split profits" />
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              When you profit, contributors get paid based on their points.
              Founders only pay out what was actually earned.
            </p>
            <div>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">March payout</span>
                <span className="font-semibold text-primary">$2,400</span>
              </div>
              <div className="flex h-7 overflow-hidden rounded-lg">
                <div className="flex w-[45%] items-center justify-center bg-primary text-xs font-medium text-primary-foreground">
                  45%
                </div>
                <div className="flex w-[30%] items-center justify-center bg-primary/70 text-xs font-medium text-primary-foreground">
                  30%
                </div>
                <div className="flex w-[25%] items-center justify-center bg-primary/50 text-xs font-medium text-primary-foreground">
                  25%
                </div>
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Sarah M.</span>
                <span>Alex K.</span>
                <span>Jordan L.</span>
              </div>
            </div>
          </GlassCard>

          {/* Step 4: Verify & repeat */}
          <GlassCard>
            <StepNumber>04</StepNumber>
            <CardHeader icon={CheckCircle} title="Verify & repeat" />
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Contributors confirm receipt. Transparent history builds trust for
              future work.
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/10 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-primary" />
                  <span className="text-sm text-primary">
                    Sarah M. confirmed
                  </span>
                </div>
                <span className="text-sm font-medium text-primary">$1,080</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/10 px-3 py-2.5 opacity-60">
                <div className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-primary" />
                  <span className="text-sm text-primary">
                    Alex K. confirmed
                  </span>
                </div>
                <span className="text-sm font-medium text-primary">$720</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}

// Glass card component with Linear-style gradient border
function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-linear-to-br from-white/8 via-white/2 to-transparent p-6 backdrop-blur-sm before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:border before:border-white/8 before:bg-linear-to-br before:from-white/12 before:to-transparent before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100 md:p-8 dark:from-white/8 dark:via-white/2 dark:to-transparent dark:before:border-white/8`}
    >
      {/* Gradient border overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          padding: '1px',
          background:
            'linear-gradient(to bottom right, rgba(255,255,255,0.15), transparent 50%)',
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}

function StepNumber({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 text-lg font-semibold tracking-wide text-muted-foreground/40">
      {children}
    </div>
  )
}

function CardHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-4 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
    </div>
  )
}

function BountyRow({
  title,
  points,
  dimmed,
}: {
  title: string
  points: number
  dimmed?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-white/5 bg-white/3 px-3 py-2.5 transition-colors duration-150 hover:bg-white/6 dark:border-white/5 dark:bg-white/3 dark:hover:bg-white/6 ${dimmed ? 'opacity-50' : ''}`}
    >
      <div className="size-2 shrink-0 rounded-full bg-primary" />
      <span className="flex-1 text-sm">{title}</span>
      <span className="text-sm font-medium text-primary">+{points} pts</span>
    </div>
  )
}

function ListItem({
  children,
  icon,
  iconBg,
  iconColor,
  dimmed,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  dimmed?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-white/5 bg-white/3 px-3 py-2.5 transition-colors duration-150 hover:bg-white/6 dark:border-white/5 dark:bg-white/3 dark:hover:bg-white/6 ${dimmed ? 'opacity-50' : ''}`}
    >
      <div
        className={`flex size-6 shrink-0 items-center justify-center rounded-full ${iconBg} ${iconColor}`}
      >
        {icon}
      </div>
      <div className="flex flex-1 items-center">{children}</div>
    </div>
  )
}
