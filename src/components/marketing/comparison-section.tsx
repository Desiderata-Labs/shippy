'use client'

import { ArrowRight, BankNote01 } from '@untitled-ui/icons-react'
import { Check, X } from 'lucide-react'
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
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-accent/5 to-background py-24 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            The best of both worlds
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Freelance flexibility + equity-like upside. No cliff, no vesting, no
            waiting 4 years to see if it was worth it.
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-5 text-left text-sm font-semibold"></th>
                  <th className="px-6 py-5 text-center">
                    <div className="text-sm font-semibold text-muted-foreground">
                      Traditional
                      <br />
                      Freelance
                    </div>
                  </th>
                  <th className="px-6 py-5 text-center">
                    <div className="text-sm font-semibold text-muted-foreground">
                      Equity
                      <br />
                      Grants
                    </div>
                  </th>
                  <th className="bg-primary/5 px-6 py-5 text-center">
                    <div className="text-sm font-semibold text-primary">
                      Earn A
                      <br />
                      Slice
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {comparisons.map((row, idx) => (
                  <tr key={idx} className="transition-colors hover:bg-muted/30">
                    <td className="px-6 py-5 text-sm font-medium">
                      {row.feature}
                    </td>
                    <td className="px-6 py-5 text-center">
                      {row.freelance ? (
                        <Check className="mx-auto size-5 text-muted-foreground/60" />
                      ) : (
                        <X className="mx-auto size-5 text-muted-foreground/30" />
                      )}
                    </td>
                    <td className="px-6 py-5 text-center">
                      {row.equity ? (
                        <Check className="mx-auto size-5 text-muted-foreground/60" />
                      ) : (
                        <X className="mx-auto size-5 text-muted-foreground/30" />
                      )}
                    </td>
                    <td className="bg-primary/5 px-6 py-5 text-center">
                      {row.earnASlice ? (
                        <Check className="mx-auto size-6 text-primary" />
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

        <div className="mt-12 text-center">
          <Button size="lg" className="h-12 gap-2 rounded-lg px-6" asChild>
            <Link href="/sign-up">
              <BankNote01 className="size-4" />
              Start Earning
              <ArrowRight className="animate-arrow-nudge size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
