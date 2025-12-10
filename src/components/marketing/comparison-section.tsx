'use client'

import { ArrowRight, BankNote01, CheckCircle } from '@untitled-ui/icons-react'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const comparisons = [
  {
    feature: 'Recurring income',
    freelance: false,
    equity: true,
    earnASlice: true,
  },
  {
    feature: 'No long-term commitment',
    freelance: true,
    equity: false,
    earnASlice: true,
  },
  {
    feature: 'Immediate value for work',
    freelance: true,
    equity: false,
    earnASlice: true,
  },
  {
    feature: 'Upside if company succeeds',
    freelance: false,
    equity: true,
    earnASlice: true,
  },
  {
    feature: 'Transparent payout calculation',
    freelance: true,
    equity: false,
    earnASlice: true,
  },
  {
    feature: 'Work across multiple projects',
    freelance: true,
    equity: false,
    earnASlice: true,
  },
]

export function ComparisonSection() {
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
      {/* Background */}
      <div className="bg-grid-pattern pointer-events-none absolute inset-0 opacity-50" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

      <div className="relative mx-auto max-w-5xl px-6">
        <div
          className="mb-16 text-center"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-2 text-sm font-medium backdrop-blur-sm">
            <span className="text-primary">⚡</span>
            Best of both worlds
          </div>
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Freelance flexibility.
            <br />
            <span className="text-gradient">Equity-like upside.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            No cliff, no vesting, no waiting 4 years to see if it was worth it.
          </p>
        </div>

        {/* Comparison table */}
        <div
          className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition:
              'opacity 0.6s ease-out 0.2s, transform 0.6s ease-out 0.2s',
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-5 text-left text-sm font-semibold"></th>
                  <th className="px-6 py-5 text-center">
                    <div className="text-sm font-medium text-muted-foreground">
                      Traditional
                      <br />
                      <span className="font-semibold text-foreground">
                        Freelance
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-5 text-center">
                    <div className="text-sm font-medium text-muted-foreground">
                      Startup
                      <br />
                      <span className="font-semibold text-foreground">
                        Equity
                      </span>
                    </div>
                  </th>
                  <th className="bg-primary/5 px-6 py-5 text-center">
                    <div className="text-sm font-medium text-muted-foreground">
                      Earn A
                      <br />
                      <span className="font-semibold text-primary">Slice</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {comparisons.map((row, idx) => (
                  <tr
                    key={idx}
                    className="transition-colors hover:bg-muted/30"
                    style={{
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible
                        ? 'translateX(0)'
                        : 'translateX(-10px)',
                      transition: `opacity 0.4s ease-out ${0.3 + idx * 0.05}s, transform 0.4s ease-out ${0.3 + idx * 0.05}s`,
                    }}
                  >
                    <td className="px-6 py-4 text-sm font-medium">
                      {row.feature}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {row.freelance ? (
                        <CheckCircle className="mx-auto size-5 text-muted-foreground/50" />
                      ) : (
                        <X className="mx-auto size-5 text-muted-foreground/30" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {row.equity ? (
                        <CheckCircle className="mx-auto size-5 text-muted-foreground/50" />
                      ) : (
                        <X className="mx-auto size-5 text-muted-foreground/30" />
                      )}
                    </td>
                    <td className="bg-primary/5 px-6 py-4 text-center">
                      {row.earnASlice ? (
                        <CheckCircle className="mx-auto size-5 text-primary" />
                      ) : (
                        <X className="mx-auto size-5 text-muted-foreground/30" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div
          className="mt-12 text-center"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
            transition:
              'opacity 0.6s ease-out 0.5s, transform 0.6s ease-out 0.5s',
          }}
        >
          <Button
            size="lg"
            className="group h-12 gap-2 rounded-xl px-6 text-base"
            asChild
          >
            <Link href="/sign-up">
              <BankNote01 className="size-4" />
              Start Earning
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
