'use client'

import { ArrowRight, Plus, SearchSm } from '@untitled-ui/icons-react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function CtaSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)

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

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-24 md:py-32"
    >
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      <div className="animate-glow-pulse pointer-events-none absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />

      <div className="relative mx-auto max-w-4xl px-6">
        {/* Main CTA card */}
        <div
          className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible
              ? 'translateY(0) scale(1)'
              : 'translateY(20px) scale(0.98)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
        >
          <div className="relative p-8 md:p-12">
            {/* Content */}
            <div className="relative z-10 text-center">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                Ready to build together?
              </h2>

              <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
                Whether you&apos;re a founder who needs help or a contributor
                seeking real upside, there&apos;s a place for you here.
              </p>

              {/* Two paths */}
              <div className="mt-10 grid gap-6 sm:grid-cols-2">
                {/* For Founders */}
                <div className="rounded-2xl border border-border bg-background/80 p-6 text-left backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                    🚀
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">For Founders</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Post bounties and get help from motivated contributors who
                    are invested in your success.
                  </p>
                  <Button className="group w-full gap-2 rounded-xl" asChild>
                    <Link href="/sign-up">
                      <Plus className="size-4" />
                      Create Your Project
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </div>

                {/* For Contributors */}
                <div className="rounded-2xl border border-border bg-background/80 p-6 text-left backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent/10 text-2xl">
                    💰
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">
                    For Contributors
                  </h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Find bounties that match your skills and earn recurring
                    royalties from successful projects.
                  </p>
                  <Button
                    variant="outline"
                    className="group w-full gap-2 rounded-xl"
                    asChild
                  >
                    <Link href="/discover">
                      <SearchSm className="size-4" />
                      Find Bounties
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Trust note - hidden until we have real metrics
              <p className="mt-8 text-sm text-muted-foreground">
                Join{' '}
                <span className="font-medium text-foreground">
                  340+ contributors
                </span>{' '}
                already earning across{' '}
                <span className="font-medium text-foreground">52 projects</span>
              </p>
              */}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
