'use client'

import {
  BankNote01,
  CheckCircle,
  ClipboardCheck,
  Target01,
} from '@untitled-ui/icons-react'
import { useEffect, useRef, useState } from 'react'

const steps = [
  {
    number: '01',
    icon: Target01,
    title: 'Post bounties',
    description:
      'Create specific tasks with point rewards. Each point represents a share of your reward pool.',
    visual: (
      <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-4">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-primary" />
          <span className="text-sm font-medium">SEO blog post</span>
          <span className="ml-auto text-xs text-primary">+50 pts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-primary/60" />
          <span className="text-sm font-medium">Product video</span>
          <span className="ml-auto text-xs text-primary">+100 pts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-primary/40" />
          <span className="text-sm font-medium">Landing page copy</span>
          <span className="ml-auto text-xs text-primary">+30 pts</span>
        </div>
      </div>
    ),
  },
  {
    number: '02',
    icon: ClipboardCheck,
    title: 'Ship work',
    description:
      'Contributors claim bounties, deliver proof of work, and earn points when approved.',
    visual: (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-green-500/10 text-green-600">
            <CheckCircle className="size-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">Submission approved</div>
            <div className="text-xs text-muted-foreground">
              SEO blog post by Sarah M.
            </div>
          </div>
          <div className="text-sm font-semibold text-primary">+50 pts</div>
        </div>
      </div>
    ),
  },
  {
    number: '03',
    icon: BankNote01,
    title: 'Split profits',
    description:
      "When you profit, the pool gets distributed. Points determine each contributor's share.",
    visual: (
      <div className="space-y-2">
        <div className="flex h-8 overflow-hidden rounded-lg">
          <div className="flex w-[45%] items-center justify-center bg-primary text-xs font-semibold text-white">
            45%
          </div>
          <div className="flex w-[30%] items-center justify-center bg-primary/70 text-xs font-semibold text-white">
            30%
          </div>
          <div className="flex w-[25%] items-center justify-center bg-primary/40 text-xs font-semibold text-white">
            25%
          </div>
        </div>
        <div className="text-center text-xs text-muted-foreground">
          March payout:{' '}
          <span className="font-semibold text-primary">$2,400</span>
        </div>
      </div>
    ),
  },
  {
    number: '04',
    icon: CheckCircle,
    title: 'Verify & repeat',
    description:
      'Contributors confirm receipt. Transparent history builds trust for future work.',
    visual: (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
        <CheckCircle className="size-5 text-green-600" />
        <span className="text-sm font-medium text-green-700 dark:text-green-400">
          $1,080 confirmed received
        </span>
      </div>
    ),
  },
]

export function HowItWorksSection() {
  return (
    <section className="relative py-24 md:py-32">
      {/* Background */}
      <div className="bg-grid-pattern pointer-events-none absolute inset-0 opacity-50" />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-2 text-sm font-medium backdrop-blur-sm">
            <span className="text-primary">✦</span>
            Simple 4-step loop
          </div>
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            A simple loop that keeps everyone aligned
          </p>
        </div>

        {/* Steps */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <StepCard key={step.number} step={step} index={index} />
          ))}
        </div>

        {/* Connection line (desktop only) */}
        <div className="absolute top-1/2 left-1/2 hidden h-px w-[calc(100%-12rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-border to-transparent lg:block" />
      </div>
    </section>
  )
}

type Step = (typeof steps)[number]

function StepCard({ step, index }: { step: Step; index: number }) {
  const [isVisible, setIsVisible] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const Icon = step.icon

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      },
    )

    if (cardRef.current) {
      observer.observe(cardRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={cardRef}
      className="group relative flex flex-col rounded-2xl border border-border bg-background p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.5s ease-out ${index * 0.1}s, transform 0.5s ease-out ${index * 0.1}s`,
      }}
    >
      {/* Step number */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="size-5" />
        </div>
        <span className="text-3xl font-bold text-muted-foreground/30">
          {step.number}
        </span>
      </div>

      {/* Title & description */}
      <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
      <p className="mb-4 flex-1 text-sm text-muted-foreground">
        {step.description}
      </p>

      {/* Visual */}
      <div className="mt-auto">{step.visual}</div>
    </div>
  )
}
