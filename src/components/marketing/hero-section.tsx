'use client'

import { ArrowRight, Plus, SearchSm } from '@untitled-ui/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border/40">
      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Accent glow - very subtle */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-20 pb-24 md:pt-32 md:pb-32">
        <div className="flex flex-col items-center gap-8 text-center">
          {/* Badge */}
          <div className="animate-hero-fade-in inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-primary"></span>
            </span>
            <span className="text-muted-foreground">
              Ship work. Earn royalties.
            </span>
          </div>

          {/* Headline */}
          <h1
            className="animate-hero-fade-in max-w-4xl text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ animationDelay: '100ms' }}
          >
            Build together.
            <br />
            <span className="text-primary">Share the upside.</span>
          </h1>

          {/* Subheadline */}
          <p
            className="animate-hero-fade-in max-w-2xl text-lg text-muted-foreground md:text-xl"
            style={{ animationDelay: '200ms' }}
          >
            Post work you need help with. Contributors who deliver earn an
            ongoing share of your profits—not one-off payments, but recurring
            royalties.
          </p>

          {/* CTAs */}
          <div
            className="animate-hero-fade-in mt-2 flex flex-col gap-3 sm:flex-row"
            style={{ animationDelay: '300ms' }}
          >
            <Button size="lg" className="h-12 gap-2 rounded-lg px-6" asChild>
              <Link href="/sign-up">
                <Plus className="size-4" />
                Create a Project
                <ArrowRight className="animate-arrow-nudge size-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 gap-2 rounded-lg px-6"
              asChild
            >
              <Link href="/discover">
                <SearchSm className="size-4" />
                Find Bounties
              </Link>
            </Button>
          </div>

          {/* Visual: Simplified slice diagram */}
          <div
            className="animate-hero-fade-in mt-8 w-full max-w-2xl"
            style={{ animationDelay: '400ms' }}
          >
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="font-medium">Reward Pool</span>
                <span className="text-muted-foreground">10% of profit</span>
              </div>

              {/* The "slices" visualization */}
              <div className="flex h-12 overflow-hidden rounded-lg">
                <div
                  className="flex items-center justify-center bg-primary text-xs font-semibold text-primary-foreground"
                  style={{ width: '45%' }}
                >
                  Sarah · 45%
                </div>
                <div
                  className="flex items-center justify-center bg-primary/70 text-xs font-semibold text-primary-foreground"
                  style={{ width: '30%' }}
                >
                  Alex · 30%
                </div>
                <div
                  className="flex items-center justify-center bg-primary/50 text-xs font-semibold text-primary-foreground"
                  style={{ width: '15%' }}
                >
                  15%
                </div>
                <div
                  className="flex items-center justify-center bg-primary/30 text-xs font-semibold text-primary-foreground"
                  style={{ width: '10%' }}
                >
                  10%
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">March payout</span>
                <span className="font-semibold text-primary">$2,400 split</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
