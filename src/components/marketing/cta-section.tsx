'use client'

import { ArrowRight, Plus, SearchSm } from '@untitled-ui/icons-react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import { ParticleBackground, ParticleIntensity } from './particle-background'

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
      <ParticleBackground intensity={ParticleIntensity.Subtle} />

      <div className="relative mx-auto max-w-4xl px-6">
        {/* Main CTA card - Glass style */}
        <div
          className="relative overflow-hidden rounded-2xl bg-linear-to-br from-white/10 via-white/5 to-transparent p-8 backdrop-blur-xl md:rounded-3xl md:p-12 dark:from-white/10 dark:via-white/5 dark:to-transparent"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible
              ? 'translateY(0) scale(1)'
              : 'translateY(20px) scale(0.98)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
        >
          {/* Gradient border overlay */}
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl md:rounded-3xl"
            style={{
              padding: '1px',
              background:
                'linear-gradient(to bottom right, rgba(255,255,255,0.2), transparent 50%)',
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              maskComposite: 'exclude',
              WebkitMaskComposite: 'xor',
            }}
          />

          {/* Content */}
          <div className="relative z-10 text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
              Ready to build together?
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Whether you&apos;re a founder who needs help or a contributor
              seeking real upside, there&apos;s a place for you here.
            </p>

            {/* Two paths */}
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {/* For Founders */}
              <div className="group relative overflow-hidden rounded-xl border border-white/8 bg-white/5 p-6 text-left backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/15 hover:bg-white/8 dark:border-white/8 dark:bg-white/5 dark:hover:border-white/15 dark:hover:bg-white/8">
                <div
                  className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    padding: '1px',
                    background:
                      'linear-gradient(to bottom right, rgba(255,255,255,0.12), transparent 50%)',
                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    maskComposite: 'exclude',
                    WebkitMaskComposite: 'xor',
                  }}
                />
                <div className="relative">
                  <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-xl">
                    🚀
                  </div>
                  <h3 className="mb-2 text-base font-semibold">For Founders</h3>
                  <p className="mb-5 text-sm text-muted-foreground">
                    Post bounties and get help from motivated contributors who
                    are invested in your success.
                  </p>
                  <Button
                    className="group/btn w-full cursor-pointer gap-2 rounded-lg"
                    asChild
                  >
                    <Link href={routes.auth.signUp()}>
                      <Plus className="size-4" />
                      Create Your Project
                      <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-1" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* For Contributors */}
              <div className="group relative overflow-hidden rounded-xl border border-white/8 bg-white/5 p-6 text-left backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/15 hover:bg-white/8 dark:border-white/8 dark:bg-white/5 dark:hover:border-white/15 dark:hover:bg-white/8">
                <div
                  className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    padding: '1px',
                    background:
                      'linear-gradient(to bottom right, rgba(255,255,255,0.12), transparent 50%)',
                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    maskComposite: 'exclude',
                    WebkitMaskComposite: 'xor',
                  }}
                />
                <div className="relative">
                  <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-accent/10 text-xl">
                    💰
                  </div>
                  <h3 className="mb-2 text-base font-semibold">
                    For Contributors
                  </h3>
                  <p className="mb-5 text-sm text-muted-foreground">
                    Find bounties that match your skills and earn recurring
                    royalties from successful projects.
                  </p>
                  <Button
                    variant="outline"
                    className="group/btn w-full cursor-pointer gap-2 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    asChild
                  >
                    <Link href={routes.discover.root()}>
                      <SearchSm className="size-4" />
                      Find Bounties
                      <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
