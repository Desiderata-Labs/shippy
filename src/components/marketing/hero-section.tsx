'use client'

import { ArrowRight, Plus, SearchSm } from '@untitled-ui/icons-react'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] overflow-hidden bg-gradient-to-b from-background via-background to-muted/20">
      {/* Background grid pattern */}
      <div className="bg-grid-pattern-fade pointer-events-none absolute inset-0" />

      {/* Gradient orbs */}
      <div className="animate-glow-pulse pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-primary/20 blur-[100px]" />
      <div
        className="animate-glow-pulse pointer-events-none absolute top-1/3 right-1/4 h-72 w-72 rounded-full bg-accent/30 blur-[80px]"
        style={{ animationDelay: '1.5s' }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-24 pb-20 md:pt-32 lg:pt-40">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Text content */}
          <div className="flex flex-col justify-center">
            {/* Badge */}
            <div className="animate-fade-in-blur mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-2 text-sm font-medium backdrop-blur-sm">
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
              recurring royalties—not one-off payments.
            </p>

            {/* CTAs */}
            <div
              className="animate-fade-in-blur mt-8 flex flex-col gap-3 sm:flex-row"
              style={{ animationDelay: '300ms' }}
            >
              <Button
                size="lg"
                className="group h-12 gap-2 rounded-xl px-6 text-base"
                asChild
              >
                <Link href="/sign-up">
                  <Plus className="size-4" />
                  Create a Project
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 gap-2 rounded-xl px-6 text-base"
                asChild
              >
                <Link href="/discover">
                  <SearchSm className="size-4" />
                  Find Bounties
                </Link>
              </Button>
            </div>

            {/* Stats - hidden until we have real metrics
            <div
              className="animate-fade-in-blur mt-12 flex gap-8 border-t border-border/50 pt-8"
              style={{ animationDelay: '400ms' }}
            >
              <div>
                <div className="text-2xl font-bold text-primary">$127K+</div>
                <div className="text-sm text-muted-foreground">
                  Royalties paid
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">340+</div>
                <div className="text-sm text-muted-foreground">
                  Active contributors
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">52</div>
                <div className="text-sm text-muted-foreground">
                  Live projects
                </div>
              </div>
            </div>
            */}
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
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-32 bg-gradient-to-t from-muted/20 to-transparent" />
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
    { type: 'payout', amount: '$480', to: 'Sarah M.', time: '2h ago' },
    { type: 'approved', points: '+50', to: 'Alex K.', time: '4h ago' },
    { type: 'payout', amount: '$320', to: 'Alex K.', time: '1d ago' },
    { type: 'approved', points: '+25', to: 'Jordan L.', time: '2d ago' },
  ]

  return (
    <div className="relative w-full max-w-md">
      {/* Main card */}
      <div className="card-glow overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <span className="text-lg">🍕</span>
              </div>
              <div>
                <div className="font-semibold">SaaS Starter</div>
                <div className="text-xs text-muted-foreground">
                  Reward Pool: 10% of profit
                </div>
              </div>
            </div>
            <div className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
              Verified
            </div>
          </div>
        </div>

        {/* Pool visualization */}
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">March 2025 Split</span>
            <span className="font-semibold text-primary">$2,400</span>
          </div>

          {/* Animated bar */}
          <div className="mb-6 flex h-10 overflow-hidden rounded-lg">
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
          <div className="space-y-3">
            {contributors.map((contributor, index) => (
              <div
                key={contributor.name}
                className={`flex items-center justify-between rounded-lg px-3 py-2 transition-colors ${
                  activeSlice === index ? 'bg-muted' : ''
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
                    ${Math.round((2400 * contributor.percentage) / 100)}
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
        <div className="border-t border-border bg-muted/20 px-6 py-4">
          <div className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Recent Activity
          </div>
          <div className="space-y-2">
            {transactions.slice(0, 2).map((tx, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`size-1.5 rounded-full ${
                      tx.type === 'payout' ? 'bg-green-500' : 'bg-primary'
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
      <div className="absolute -top-4 -right-4 size-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 blur-2xl" />
      <div className="absolute -bottom-4 -left-4 size-20 rounded-full bg-gradient-to-br from-accent/20 to-primary/20 blur-2xl" />
    </div>
  )
}
