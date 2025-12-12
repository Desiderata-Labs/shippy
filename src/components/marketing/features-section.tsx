'use client'

import {
  ArrowRight,
  BankNote01,
  ChartBreakoutSquare,
  Eye,
  PieChart01,
  SearchSm,
  ShieldTick,
  Target01,
  Users01,
} from '@untitled-ui/icons-react'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import { ParticleBackground, ParticleIntensity } from './particle-background'

export function FeaturesSection() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <ParticleBackground intensity={ParticleIntensity.Subtle} />
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
            <PieChart01 className="size-4 text-primary" />
            The Core Loop
          </div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Bounty → Ship → Earn → Repeat
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Ship real work, earn real upside.
          </p>
        </div>

        {/* Bento grid - Linear style */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          {/* Row 1: Claim bounties (4 cols) + Earn royalties (2 cols) */}
          <GlassCard className="md:col-span-4">
            <CardHeader icon={Target01} title="Claim bounties, ship results" />
            <p className="mt-2 text-sm text-muted-foreground">
              Browse open tasks with clear requirements and point rewards.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <BountyItem
                title="SEO Blog Article"
                points={50}
                status="open"
                avatar="S"
                assignee="sarah"
              />
              <BountyItem
                title="Product Demo Video"
                points={100}
                status="claimed"
                avatar="M"
                assignee="marcus"
              />
              <BountyItem
                title="Onboarding Email Sequence"
                points={75}
                status="open"
                avatar="J"
                assignee="julia"
              />
            </div>
          </GlassCard>

          <GlassCard className="md:col-span-2">
            <CardHeader icon={BankNote01} title="Recurring royalties" />
            <p className="mt-2 text-sm text-muted-foreground">
              Every time the project profits, you get paid.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <PayoutItem month="March" amount={480} verified />
              <PayoutItem month="February" amount={420} verified />
              <PayoutItem month="January" amount={380} verified />
            </div>
          </GlassCard>

          {/* Row 2: Three equal columns */}
          <GlassCard className="md:col-span-2">
            <CardHeader icon={PieChart01} title="Transparent pools" />
            <p className="mt-2 text-sm text-muted-foreground">
              See pool commitment, payout history, and verification.
            </p>
            <div className="mt-5">
              <div className="flex h-4 overflow-hidden rounded-sm">
                <div className="w-[45%] bg-primary" />
                <div className="w-[30%] bg-primary/70" />
                <div className="w-[15%] bg-primary/50" />
                <div className="w-[10%] bg-primary/30" />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">4 contributors</span>
                <span className="font-medium text-primary">10% pool</span>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="md:col-span-2">
            <CardHeader icon={Users01} title="Build reputation" />
            <p className="mt-2 text-sm text-muted-foreground">
              Track earnings across projects.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <StatBlock value="$2.4K" label="Earned" />
              <StatBlock value="12" label="Bounties" />
              <StatBlock value="98%" label="Verified" highlight />
            </div>
          </GlassCard>

          <GlassCard className="md:col-span-2">
            <CardHeader icon={Eye} title="Full visibility" />
            <p className="mt-2 text-sm text-muted-foreground">
              See exactly how points translate to payouts.
            </p>
            <div className="mt-5 flex flex-col gap-1.5">
              <VisibilityRow label="Your points" value="125 pts" />
              <VisibilityRow label="Pool capacity" value="1,000 pts" />
              <VisibilityRow label="Your payout" value="$625" highlight />
            </div>
          </GlassCard>

          {/* Row 3: Trust + Tracking */}
          <GlassCard className="md:col-span-4">
            <CardHeader icon={ShieldTick} title="Trust through transparency" />
            <p className="mt-2 text-sm text-muted-foreground">
              Public contributor lists, visible payout history, and verification
              badges.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Pill variant="success">✓ Verified payouts</Pill>
              <Pill variant="primary">340+ contributors</Pill>
              <Pill variant="default">Public history</Pill>
              <Pill variant="default">No hidden terms</Pill>
            </div>
          </GlassCard>

          <GlassCard className="md:col-span-2">
            <CardHeader icon={ChartBreakoutSquare} title="Real-time tracking" />
            <p className="mt-2 text-sm text-muted-foreground">
              Watch your earnings grow.
            </p>
            <div className="mt-5 flex items-end gap-1">
              {[35, 45, 38, 52, 48, 65, 72].map((height, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-primary/30 transition-all duration-200 hover:bg-primary/60"
                  style={{ height: `${height}px` }}
                />
              ))}
            </div>
          </GlassCard>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center md:mt-16">
          <Button
            size="lg"
            className="group h-12 cursor-pointer gap-2 rounded-xl px-6 text-base"
            asChild
          >
            <Link href={routes.discover.root()}>
              <SearchSm className="size-4" />
              Browse Projects
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

// Glass card component with Linear-style gradient border
function GlassCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-linear-to-br from-white/8 via-white/2 to-transparent p-5 backdrop-blur-sm before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:border before:border-white/8 before:bg-linear-to-br before:from-white/12 before:to-transparent before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100 dark:from-white/8 dark:via-white/2 dark:to-transparent dark:before:border-white/8 ${className}`}
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

function CardHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-4 text-primary" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
    </div>
  )
}

function BountyItem({
  title,
  points,
  status,
  avatar,
  assignee,
}: {
  title: string
  points: number
  status: 'open' | 'claimed'
  avatar: string
  assignee: string
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border border-white/5 bg-white/3 px-3 py-2.5 transition-colors duration-150 hover:bg-white/6 dark:border-white/5 dark:bg-white/3 dark:hover:bg-white/6 ${status === 'claimed' ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-6 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-muted-foreground uppercase">
          {avatar}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground">{assignee}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-medium ${status === 'open' ? 'text-green-400' : 'text-muted-foreground'}`}
        >
          {status === 'open' ? 'Open' : 'Claimed'}
        </span>
        <span className="text-sm font-semibold text-primary">+{points}</span>
      </div>
    </div>
  )
}

function PayoutItem({
  month,
  amount,
  verified,
}: {
  month: string
  amount: number
  verified?: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/3 px-3 py-2.5 transition-colors duration-150 hover:bg-white/6 dark:border-white/5 dark:bg-white/3 dark:hover:bg-white/6">
      <span className="text-sm text-muted-foreground">{month}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">${amount}</span>
        {verified && <ShieldTick className="size-3.5 text-green-400" />}
      </div>
    </div>
  )
}

function StatBlock({
  value,
  label,
  highlight,
}: {
  value: string
  label: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/3 px-3 py-2.5 text-center dark:border-white/5 dark:bg-white/3">
      <div
        className={`text-lg font-semibold ${highlight ? 'text-green-400' : ''}`}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function VisibilityRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg px-3 py-2 ${
        highlight
          ? 'border border-primary/20 bg-primary/10'
          : 'border border-white/5 bg-white/3 dark:border-white/5 dark:bg-white/3'
      }`}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-semibold ${highlight ? 'text-primary' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}

function Pill({
  children,
  variant,
}: {
  children: React.ReactNode
  variant: 'success' | 'primary' | 'default'
}) {
  const variantClasses = {
    success: 'border-green-500/20 bg-green-500/10 text-green-400',
    primary: 'border-primary/20 bg-primary/10 text-primary',
    default:
      'border-white/8 bg-white/5 text-muted-foreground dark:border-white/8 dark:bg-white/5',
  }

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  )
}
