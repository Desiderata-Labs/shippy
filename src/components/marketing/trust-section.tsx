'use client'

// Hidden until we have real metrics - uncomment when ready
// import { CheckVerified02, ShieldTick } from '@untitled-ui/icons-react'

// const trustStats = [
//   { value: '$127K+', label: 'Paid to contributors' },
//   { value: '98%', label: 'Payout verification rate' },
//   { value: '52', label: 'Active projects' },
//   { value: '340+', label: 'Contributors earning' },
// ]

// const projectTypes = [
//   'SaaS',
//   'E-commerce',
//   'Developer Tools',
//   'Content Platforms',
//   'AI/ML Products',
//   'Mobile Apps',
//   'Marketplaces',
//   'Analytics',
// ]

export function TrustSection() {
  // Hidden until we have real metrics - uncomment when ready
  return null

  /*
  return (
    <section className="relative overflow-hidden border-y border-border/40 bg-muted/20 py-16">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <ShieldTick className="size-4 text-primary" />
          <span>Trusted by founders and contributors worldwide</span>
        </div>

        <div className="mb-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {trustStats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center text-center"
            >
              <div className="text-2xl font-bold md:text-3xl">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute top-0 left-0 z-10 h-full w-24 bg-gradient-to-r from-muted/80 to-transparent" />
          <div className="pointer-events-none absolute top-0 right-0 z-10 h-full w-24 bg-gradient-to-l from-muted/80 to-transparent" />

          <div className="flex overflow-hidden">
            <div className="animate-scroll-left flex shrink-0 items-center gap-8">
              {[...projectTypes, ...projectTypes].map((type, index) => (
                <div
                  key={`${type}-${index}`}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-2 text-sm font-medium backdrop-blur-sm"
                >
                  <CheckVerified02 className="size-4 text-primary" />
                  {type}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="flex size-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium"
                >
                  {['SM', 'AK', 'JL', 'TR'][i]}
                </div>
              ))}
            </div>
            <span className="ml-2">
              <span className="font-medium text-foreground">
                340+ contributors
              </span>{' '}
              earning across all projects
            </span>
          </div>
        </div>
      </div>
    </section>
  )
  */
}
