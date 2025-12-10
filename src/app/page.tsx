import {
  ArrowRight,
  PieChart01,
  Target01,
  Users01,
} from '@untitled-ui/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="container flex flex-col items-center justify-center gap-6 px-4 py-24 text-center md:py-32">
        <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <PieChart01 className="mr-1.5 size-4" />
          Ship work. Earn royalties.
        </div>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Open-source your startup&apos;s growth.{' '}
          <span className="text-primary">Share the upside.</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
          Post real work (growth, marketing, sales), and contributors who help
          ship it earn an ongoing share of the profits—not just a one-off
          payment.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/sign-up">
              Get Started
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/discover">Browse Projects</Link>
          </Button>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border/40 bg-linear-to-b from-transparent to-secondary/20 py-24">
        <div className="container px-4">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              A simple loop that aligns everyone&apos;s incentives
            </p>
          </div>
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Target01 className="size-7" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">1. Post Bounties</h3>
              <p className="text-muted-foreground">
                Founders post specific tasks with point rewards. Each point
                represents a share of the reward pool.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users01 className="size-7" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">2. Ship Results</h3>
              <p className="text-muted-foreground">
                Contributors claim bounties, deliver verified work, and earn
                points when approved.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <PieChart01 className="size-7" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">3. Earn Royalties</h3>
              <p className="text-muted-foreground">
                When the project profits, contributors get paid proportionally
                to their points. Every month or quarter.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border/40 py-24">
        <div className="container flex flex-col items-center gap-6 px-4 text-center">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to build together?
          </h2>
          <p className="max-w-xl text-lg text-muted-foreground">
            Whether you&apos;re a founder looking for growth help or a
            contributor seeking upside, there&apos;s a place for you here.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/sign-up">Create Your Project</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/discover">Find Work</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
          <div className="flex items-center gap-2">
            <PieChart01 className="size-5 text-primary" />
            <span className="font-semibold">Earn A Slice</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Earn A Slice. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
