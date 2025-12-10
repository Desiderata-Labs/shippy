'use client'

import {
  ArrowRight,
  BankNote01,
  PieChart01,
  SearchSm,
  Target01,
  Users01,
} from '@untitled-ui/icons-react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BountyCardPreview } from './previews/bounty-card-preview'
import { ContributorStatsPreview } from './previews/contributor-stats-preview'
import { PayoutPreview } from './previews/payout-preview'
import { ProjectPreview } from './previews/project-preview'

type FeatureCard = {
  icon: React.ReactNode
  title: string
  description: string
  visual: React.ReactNode
}

const features: FeatureCard[] = [
  {
    icon: <Target01 className="size-5" />,
    title: 'Claim bounties, ship results',
    description:
      'Browse open tasks with clear requirements and point rewards. Claim what matches your skills and deliver.',
    visual: <BountyCardPreview />,
  },
  {
    icon: <BankNote01 className="size-5" />,
    title: 'Earn recurring royalties',
    description:
      'Every time the project profits, you get paid. Not a one-time payment—ongoing income proportional to your contribution.',
    visual: <PayoutPreview />,
  },
  {
    icon: <Users01 className="size-5" />,
    title: 'Build your portfolio',
    description:
      'Track your earnings across projects. Build a reputation as a trusted contributor with verified payout history.',
    visual: <ContributorStatsPreview />,
  },
  {
    icon: <PieChart01 className="size-5" />,
    title: 'Transparent reward pools',
    description:
      'Every project shows its reward pool commitment, payout history, and contributor verification status.',
    visual: <ProjectPreview />,
  },
]

export function FeaturesSection() {
  return (
    <section className="relative bg-gradient-to-b from-background via-muted/20 to-background py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium">
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

        {/* Features Grid */}
        <div className="grid gap-8 md:grid-cols-2">
          {features.map((feature, index) => (
            <FeatureCardItem
              key={feature.title}
              feature={feature}
              index={index}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <Button size="lg" className="h-12 gap-2 rounded-lg px-6" asChild>
            <Link href="/discover">
              <SearchSm className="size-4" />
              Browse Projects
              <ArrowRight className="animate-arrow-nudge size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

type FeatureCardItemProps = {
  feature: FeatureCard
  index: number
}

function FeatureCardItem({ feature, index }: FeatureCardItemProps) {
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
        rootMargin: '0px 0px -100px 0px',
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
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/50 bg-background shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.5s ease-out ${index * 0.1}s, transform 0.5s ease-out ${index * 0.1}s`,
      }}
    >
      {/* Text content */}
      <div className="space-y-3 p-6">
        <div className="flex items-center gap-2 text-primary">
          {feature.icon}
          <h3 className="font-semibold">{feature.title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{feature.description}</p>
      </div>

      {/* Visual */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {feature.visual}
      </div>
    </div>
  )
}
