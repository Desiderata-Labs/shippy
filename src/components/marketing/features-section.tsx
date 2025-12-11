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
import { Button } from '@/components/ui/button'

export function FeaturesSection() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium">
            <PieChart01 className="size-4 text-primary" />
            The Core Loop
          </div>
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Bounty → Ship → Earn → Repeat
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Ship real work, earn real upside.
          </p>
        </div>

        {/* Bento grid - 6 columns for precise control */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6 md:gap-4">
          {/* Row 1: Claim bounties (4 cols) + Earn royalties (2 cols) */}
          <div className="group rounded-2xl border border-border bg-card p-6 md:col-span-4">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Target01 className="size-5" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">
              Claim bounties, ship results
            </h3>
            <p className="text-sm text-muted-foreground">
              Browse open tasks with clear requirements and point rewards. Claim
              what matches your skills and deliver.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <BountyCard
                title="SEO Blog Article"
                points={50}
                status="open"
                skills={['Content', 'SEO']}
              />
              <BountyCard
                title="Product Demo Video"
                points={100}
                status="claimed"
                skills={['Video', 'Marketing']}
              />
            </div>
          </div>

          <div className="group rounded-2xl border border-border bg-card p-6 md:col-span-2">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BankNote01 className="size-5" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">
              Earn recurring royalties
            </h3>
            <p className="text-sm text-muted-foreground">
              Every time the project profits, you get paid. Ongoing income
              proportional to your contribution.
            </p>
            <div className="mt-5 space-y-2">
              <PayoutRow month="March" amount={480} verified />
              <PayoutRow month="February" amount={420} verified />
              <PayoutRow month="January" amount={380} verified />
            </div>
          </div>

          {/* Row 2: Transparent pools (2 cols) + Build reputation (2 cols) + Full visibility (2 cols) */}
          <div className="group rounded-2xl border border-border bg-card p-6 md:col-span-2">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PieChart01 className="size-5" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Transparent pools</h3>
            <p className="text-sm text-muted-foreground">
              Every project shows its reward pool commitment, payout history,
              and verification status.
            </p>
            <div className="mt-5">
              <div className="flex h-5 overflow-hidden rounded-md">
                <div className="w-[45%] bg-primary" />
                <div className="w-[30%] bg-primary/70" />
                <div className="w-[15%] bg-primary/50" />
                <div className="w-[10%] bg-primary/30" />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>4 contributors</span>
                <span className="font-medium text-primary">10% pool</span>
              </div>
            </div>
          </div>

          <div className="group rounded-2xl border border-border bg-card p-6 md:col-span-2">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users01 className="size-5" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">
              Build your reputation
            </h3>
            <p className="text-sm text-muted-foreground">
              Track earnings across projects. Build a verified payout history.
            </p>
            <div className="mt-5 flex items-center justify-between">
              <div className="text-center">
                <div className="text-xl font-bold">$2.4K</div>
                <div className="text-xs text-muted-foreground">Earned</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-xl font-bold">12</div>
                <div className="text-xs text-muted-foreground">Bounties</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">98%</div>
                <div className="text-xs text-muted-foreground">Verified</div>
              </div>
            </div>
          </div>

          <div className="group rounded-2xl border border-border bg-card p-6 md:col-span-2">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Eye className="size-5" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Full visibility</h3>
            <p className="text-sm text-muted-foreground">
              See exactly how points translate to payouts. No surprises, no
              hidden calculations.
            </p>
            <div className="mt-5 space-y-1.5 text-sm">
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5">
                <span className="text-muted-foreground">Your points</span>
                <span className="font-medium">1,250</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5">
                <span className="text-muted-foreground">Pool share</span>
                <span className="font-medium">8.3%</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-1.5">
                <span className="text-muted-foreground">Your payout</span>
                <span className="font-semibold text-primary">$415</span>
              </div>
            </div>
          </div>

          {/* Row 3: Trust transparency (4 cols) + Real-time tracking (2 cols) */}
          <div className="group rounded-2xl border border-border bg-card p-6 md:col-span-4">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldTick className="size-5" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">
              Trust through transparency
            </h3>
            <p className="text-sm text-muted-foreground">
              Public contributor lists, visible payout history, and verification
              badges.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge variant="success">✓ Verified payouts</Badge>
              <Badge variant="primary">340+ contributors</Badge>
              <Badge variant="muted">Public history</Badge>
              <Badge variant="muted">No hidden terms</Badge>
            </div>
          </div>

          <div className="group rounded-2xl border border-border bg-card p-6 md:col-span-2">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ChartBreakoutSquare className="size-5" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Real-time tracking</h3>
            <p className="text-sm text-muted-foreground">
              Watch your earnings grow as the project succeeds. Dashboard shows
              all activity.
            </p>
            <div className="mt-5 flex items-end gap-1">
              {[35, 45, 38, 52, 48, 65, 72].map((height, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-primary/20 transition-all hover:bg-primary/40"
                  style={{ height: `${height}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center md:mt-16">
          <Button
            size="lg"
            className="group h-12 cursor-pointer gap-2 rounded-xl px-6 text-base"
            asChild
          >
            <Link href="/discover">
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

function BountyCard({
  title,
  points,
  status,
  skills,
}: {
  title: string
  points: number
  status: 'open' | 'claimed'
  skills: string[]
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-3">
      <div className="mb-2 flex items-start justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            status === 'open'
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
          }`}
        >
          {status === 'open' ? 'Open' : 'Claimed'}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {skills.map((skill) => (
            <span
              key={skill}
              className="rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              {skill}
            </span>
          ))}
        </div>
        <span className="text-sm font-semibold text-primary">
          +{points} pts
        </span>
      </div>
    </div>
  )
}

function PayoutRow({
  month,
  amount,
  verified,
}: {
  month: string
  amount: number
  verified?: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
      <span className="text-sm text-muted-foreground">{month}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">${amount}</span>
        {verified && (
          <ShieldTick className="size-4 text-green-600 dark:text-green-400" />
        )}
      </div>
    </div>
  )
}

function Badge({
  children,
  variant,
}: {
  children: React.ReactNode
  variant: 'success' | 'primary' | 'muted'
}) {
  const variantClasses = {
    success: 'bg-green-500/10 text-green-700 dark:text-green-400',
    primary: 'bg-primary/10 text-primary',
    muted: 'bg-muted text-muted-foreground',
  }

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  )
}
