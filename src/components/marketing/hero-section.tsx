'use client'

import { ArrowRight, Plus, SearchSm } from '@untitled-ui/icons-react'
import { useState } from 'react'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import { HeroEffects } from './hero-effects'

export function HeroSection() {
  return (
    <section className="relative -mt-20 min-h-[90vh] overflow-hidden bg-linear-to-b from-background via-background to-muted/20">
      {/* Background grid pattern */}
      <div className="bg-grid-pattern-fade pointer-events-none absolute inset-0" />

      {/* Background effects - particles with noise */}
      <HeroEffects />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-32 pb-20 md:pt-40 lg:pt-48">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Text content */}
          <div className="flex flex-col justify-center">
            {/* Badge */}
            <div className="animate-fade-in-blur mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-primary"></span>
              </span>
              <span className="text-muted-foreground">
                The future of startup work
              </span>
            </div>

            {/* Headline */}
            <h1
              className="animate-fade-in-blur text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
              style={{ animationDelay: '100ms' }}
            >
              Build together.
              <br />
              <span className="text-gradient">Share the upside.</span>
            </h1>

            {/* Subheadline */}
            <p
              className="animate-fade-in-blur mt-6 max-w-lg text-lg text-muted-foreground md:text-xl"
              style={{ animationDelay: '200ms' }}
            >
              Post work you need help with. Contributors who deliver earn
              recurring royalties, not just one-off payments.
            </p>

            {/* CTAs */}
            <div
              className="animate-fade-in-blur mt-8 flex flex-col gap-3 sm:flex-row"
              style={{ animationDelay: '300ms' }}
            >
              <Button
                size="lg"
                className="group h-12 cursor-pointer gap-2 rounded-xl px-6 text-base"
                asChild
              >
                <Link href={routes.auth.signUp()}>
                  <Plus className="size-4" />
                  Create a Project
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 cursor-pointer gap-2 rounded-xl border-white/10 bg-white/5 px-6 text-base hover:bg-white/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                asChild
              >
                <Link href={routes.discover.root()}>
                  <SearchSm className="size-4" />
                  Find Bounties
                </Link>
              </Button>
            </div>
          </div>

          {/* Right: Interactive visualization */}
          <div
            className="animate-fade-in-blur flex items-center justify-center lg:justify-end"
            style={{ animationDelay: '300ms' }}
          >
            <RewardPoolVisualization />
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-32 bg-linear-to-t from-muted/20 to-transparent" />
    </section>
  )
}

function RewardPoolVisualization() {
  const [activeSlice, setActiveSlice] = useState<number | null>(null)

  const contributors = [
    { name: 'Sarah M.', points: 450, percentage: 45, color: 'bg-primary' },
    {
      name: 'Alex K.',
      points: 300,
      percentage: 30,
      color: 'bg-primary/70',
    },
    {
      name: 'Jordan L.',
      points: 150,
      percentage: 15,
      color: 'bg-primary/50',
    },
    {
      name: 'Taylor R.',
      points: 100,
      percentage: 10,
      color: 'bg-primary/30',
    },
  ]

  const transactions = [
    { type: 'payout', amount: '$5,175', to: 'Sarah M.', time: '2h ago' },
    { type: 'approved', points: '+50', to: 'Alex K.', time: '4h ago' },
  ]

  return (
    <div className="relative w-full max-w-md">
      {/* Main card - Linear glass style */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-background/95 via-background/90 to-background/80 backdrop-blur-xl dark:from-background/95 dark:via-background/90 dark:to-background/80">
        {/* Gradient border overlay */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            padding: '1px',
            background:
              'linear-gradient(to bottom right, rgba(255,255,255,0.2), transparent 50%)',
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'exclude',
            WebkitMaskComposite: 'xor',
          }}
        />

        {/* Header */}
        <div className="relative border-b border-white/8 px-6 py-4 dark:border-white/8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <span className="text-lg">📸</span>
              </div>
              <div>
                <div className="font-semibold">Image AI</div>
                <div className="text-xs text-muted-foreground">
                  Reward Pool: 10% of $115k/mo profit
                </div>
              </div>
            </div>
            <div className="rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400">
              Verified
            </div>
          </div>
        </div>

        {/* Pool visualization */}
        <div className="relative p-6">
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">December 2025 Split</span>
            <span className="font-semibold text-primary">$11,500</span>
          </div>

          {/* Animated bar */}
          <div className="mb-6 flex h-9 overflow-hidden rounded-lg">
            {contributors.map((contributor, index) => (
              <div
                key={contributor.name}
                className={`${contributor.color} animate-bar-grow flex cursor-pointer items-center justify-center text-xs font-semibold text-white transition-opacity duration-300 hover:opacity-80`}
                style={{
                  flexBasis: `${contributor.percentage}%`,
                  animationDelay: `${index * 0.1}s`,
                }}
                onMouseEnter={() => setActiveSlice(index)}
                onMouseLeave={() => setActiveSlice(null)}
              >
                {contributor.percentage >= 15 && `${contributor.percentage}%`}
              </div>
            ))}
          </div>

          {/* Contributors list */}
          <div className="space-y-2">
            {contributors.map((contributor, index) => (
              <div
                key={contributor.name}
                className={`flex items-center justify-between rounded-lg border border-white/5 bg-white/3 px-3 py-2.5 transition-all duration-150 dark:border-white/5 dark:bg-white/3 ${
                  activeSlice === index
                    ? 'border-white/15 bg-white/8 dark:border-white/15 dark:bg-white/8'
                    : 'hover:bg-white/6 dark:hover:bg-white/6'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`size-3 rounded-full ${contributor.color}`} />
                  <span className="text-sm font-medium">
                    {contributor.name}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    $
                    {Math.round(
                      (11500 * contributor.percentage) / 100,
                    ).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {contributor.points} pts
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div className="relative border-t border-white/8 px-6 py-4 dark:border-white/8">
          <div className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Recent Activity
          </div>
          <div className="space-y-2">
            {transactions.map((tx, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`size-1.5 rounded-full ${
                      tx.type === 'payout' ? 'bg-green-400' : 'bg-primary'
                    }`}
                  />
                  <span className="text-muted-foreground">
                    {tx.type === 'payout' ? (
                      <>
                        <span className="font-medium text-foreground">
                          {tx.amount}
                        </span>{' '}
                        sent to {tx.to}
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-foreground">
                          {tx.points}
                        </span>{' '}
                        awarded to {tx.to}
                      </>
                    )}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{tx.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating decoration */}
      <div className="absolute -top-4 -right-4 size-24 rounded-full bg-linear-to-br from-primary/20 to-accent/20 blur-2xl" />
      <div className="absolute -bottom-4 -left-4 size-20 rounded-full bg-linear-to-br from-accent/20 to-primary/20 blur-2xl" />
    </div>
  )
}
