import {
  BankNote01,
  CheckCircle,
  ClipboardCheck,
  Target01,
} from '@untitled-ui/icons-react'

export function HowItWorksSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium">
            <span className="text-primary">✦</span>
            From task to payout
          </div>
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            No vesting schedules. Just ship work and get paid.
          </p>
        </div>

        {/* Steps - 2x2 grid for better spacing */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Step 1: Post bounties */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
            <div className="mb-4 text-lg font-bold tracking-wide text-muted-foreground/50">
              01
            </div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Target01 className="size-5" />
              </div>
              <h3 className="text-xl font-semibold">Post bounties</h3>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Create specific tasks with point rewards. Each point represents a
              share of your reward pool.
            </p>
            <div className="space-y-2">
              <BountyRow title="SEO blog post" points={50} />
              <BountyRow title="Product video" points={100} opacity={0.7} />
              <BountyRow title="Landing page copy" points={30} opacity={0.5} />
            </div>
          </div>

          {/* Step 2: Ship work */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
            <div className="mb-4 text-lg font-bold tracking-wide text-muted-foreground/50">
              02
            </div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ClipboardCheck className="size-5" />
              </div>
              <h3 className="text-xl font-semibold">Ship work</h3>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Contributors claim bounties, deliver proof of work, and earn
              points when approved.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-400">
                  <CheckCircle className="size-3.5" />
                </div>
                <div className="flex-1">
                  <span className="text-sm">SEO blog post</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    by Sarah M.
                  </span>
                </div>
                <span className="text-sm font-medium text-primary">
                  +50 pts
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5 opacity-60">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-400">
                  <ClipboardCheck className="size-3.5" />
                </div>
                <div className="flex-1">
                  <span className="text-sm">Product video</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    in review
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Split profits */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
            <div className="mb-4 text-lg font-bold tracking-wide text-muted-foreground/50">
              03
            </div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BankNote01 className="size-5" />
              </div>
              <h3 className="text-xl font-semibold">Split profits</h3>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              When you profit, the pool gets distributed. Points determine each
              contributor&apos;s share.
            </p>
            <div>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">March payout</span>
                <span className="font-semibold text-primary">$2,400</span>
              </div>
              <div className="flex h-8 overflow-hidden rounded-lg">
                <div className="flex w-[45%] items-center justify-center bg-primary text-xs font-medium text-primary-foreground">
                  45%
                </div>
                <div className="flex w-[30%] items-center justify-center bg-primary/70 text-xs font-medium text-primary-foreground">
                  30%
                </div>
                <div className="flex w-[25%] items-center justify-center bg-primary/50 text-xs font-medium text-primary-foreground">
                  25%
                </div>
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Sarah M.</span>
                <span>Alex K.</span>
                <span>Jordan L.</span>
              </div>
            </div>
          </div>

          {/* Step 4: Verify & repeat */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
            <div className="mb-4 text-lg font-bold tracking-wide text-muted-foreground/50">
              04
            </div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CheckCircle className="size-5" />
              </div>
              <h3 className="text-xl font-semibold">Verify & repeat</h3>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              Contributors confirm receipt. Transparent history builds trust for
              future work.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-400" />
                  <span className="text-sm text-green-400">
                    Sarah M. confirmed
                  </span>
                </div>
                <span className="text-sm font-medium text-green-400">
                  $1,080
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2.5 opacity-60">
                <div className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-400" />
                  <span className="text-sm text-green-400">
                    Alex K. confirmed
                  </span>
                </div>
                <span className="text-sm font-medium text-green-400">$720</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function BountyRow({
  title,
  points,
  opacity = 1,
}: {
  title: string
  points: number
  opacity?: number
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5"
      style={{ opacity }}
    >
      <div className="size-2 shrink-0 rounded-full bg-primary" />
      <span className="flex-1 text-sm">{title}</span>
      <span className="text-sm font-medium text-primary">+{points} pts</span>
    </div>
  )
}
