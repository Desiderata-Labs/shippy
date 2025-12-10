'use client'

import { ArrowRight } from '@untitled-ui/icons-react'

const steps = [
  {
    number: '01',
    title: 'Post bounties',
    description:
      'Create specific tasks with point rewards. Each point represents a share of your reward pool.',
  },
  {
    number: '02',
    title: 'Ship work',
    description:
      'Contributors claim bounties, deliver proof of work, and earn points when approved.',
  },
  {
    number: '03',
    title: 'Split profits',
    description:
      "When you profit, the pool gets distributed. Points determine each contributor's share.",
  },
  {
    number: '04',
    title: 'Verify & repeat',
    description:
      'Contributors confirm receipt. Transparent history builds trust for future work.',
  },
]

export function HowItWorksSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        {/* Header */}
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            A simple loop that keeps everyone aligned
          </p>
        </div>

        {/* Steps */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Arrow connector (hidden on last item and mobile) */}
              {index < steps.length - 1 && (
                <ArrowRight className="absolute top-4 -right-5 hidden size-4 text-border lg:block" />
              )}

              <div className="text-4xl font-bold text-primary/20">
                {step.number}
              </div>
              <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
