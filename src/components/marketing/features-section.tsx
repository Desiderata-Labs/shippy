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
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

type Feature = {
  icon: React.ReactNode
  title: string
  description: string
  span?: 'wide' | 'tall' | 'large'
  visual?: React.ReactNode
}

const features: Feature[] = [
  {
    icon: <Target01 className="size-5" />,
    title: 'Claim bounties, ship results',
    description:
      'Browse open tasks with clear requirements and point rewards. Claim what matches your skills and deliver.',
    span: 'wide',
    visual: (
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
    ),
  },
  {
    icon: <BankNote01 className="size-5" />,
    title: 'Earn recurring royalties',
    description:
      'Every time the project profits, you get paid. Ongoing income proportional to your contribution.',
    visual: (
      <div className="mt-4 space-y-2">
        <PayoutRow month="March" amount={480} verified />
        <PayoutRow month="February" amount={420} verified />
        <PayoutRow month="January" amount={380} verified />
      </div>
    ),
  },
  {
    icon: <PieChart01 className="size-5" />,
    title: 'Transparent pools',
    description:
      'Every project shows its reward pool commitment, payout history, and verification status.',
    visual: (
      <div className="mt-4">
        <div className="flex h-6 overflow-hidden rounded-lg">
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
    ),
  },
  {
    icon: <Users01 className="size-5" />,
    title: 'Build your reputation',
    description:
      'Track earnings across projects. Build a verified payout history.',
    visual: (
      <div className="mt-4 flex items-center gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold">$2.4K</div>
          <div className="text-xs text-muted-foreground">Earned</div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <div className="text-2xl font-bold">12</div>
          <div className="text-xs text-muted-foreground">Bounties</div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">98%</div>
          <div className="text-xs text-muted-foreground">Verified</div>
        </div>
      </div>
    ),
  },
  {
    icon: <ShieldTick className="size-5" />,
    title: 'Trust through transparency',
    description:
      'Public contributor lists, visible payout history, and verification badges.',
    span: 'wide',
    visual: (
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="success">✓ Verified payouts</Badge>
        <Badge variant="primary">340+ contributors</Badge>
        <Badge variant="muted">Public history</Badge>
        <Badge variant="muted">No hidden terms</Badge>
      </div>
    ),
  },
  {
    icon: <Eye className="size-5" />,
    title: 'Full visibility',
    description:
      'See exactly how points translate to payouts. No surprises, no hidden calculations.',
  },
  {
    icon: <ChartBreakoutSquare className="size-5" />,
    title: 'Real-time tracking',
    description:
      'Watch your earnings grow as the project succeeds. Dashboard shows all activity.',
  },
]

export function FeaturesSection() {
  return (
    <section className="relative bg-gradient-to-b from-muted/20 via-background to-muted/20 py-24 md:py-32">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-32 size-64 rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute -right-32 bottom-1/4 size-64 rounded-full bg-accent/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-2 text-sm font-medium backdrop-blur-sm">
            <PieChart01 className="size-4 text-primary" />
            The Core Loop
          </div>
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Bounty → Ship → Earn → Repeat
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            A simple loop that aligns founders and contributors. Ship real work,
            earn real upside.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <Button
            size="lg"
            className="group h-12 gap-2 rounded-xl px-6 text-base"
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

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const [isVisible, setIsVisible] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

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

  const spanClass =
    feature.span === 'wide'
      ? 'md:col-span-2 lg:col-span-2'
      : feature.span === 'large'
        ? 'md:col-span-2 lg:col-span-2 lg:row-span-2'
        : ''

  return (
    <div
      ref={cardRef}
      className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg ${spanClass}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.5s ease-out ${index * 0.05}s, transform 0.5s ease-out ${index * 0.05}s`,
      }}
    >
      {/* Icon */}
      <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {feature.icon}
      </div>

      {/* Title */}
      <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground">{feature.description}</p>

      {/* Visual (if any) */}
      {feature.visual}
    </div>
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
