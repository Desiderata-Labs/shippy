'use client'

import { BankNote03, PieChart01, TrendUp01 } from '@untitled-ui/icons-react'
import { memo } from 'react'

const ContributorStatsPreviewComponent = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-background via-background to-muted/15 p-6">
      <div className="flex size-full max-w-[360px] flex-col gap-4 rounded-[28px] border border-border/40 bg-background/95 p-5 shadow-[0_24px_48px_rgba(15,23,42,0.12)] ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/40 pb-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            SC
          </div>
          <div>
            <p className="font-semibold">Sarah Chen</p>
            <p className="text-xs text-muted-foreground">Top Contributor</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-primary">
              <BankNote03 className="size-4" />
              <span className="text-xs font-semibold tracking-wider uppercase">
                Total Points
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold">4,850</p>
          </div>

          <div className="rounded-2xl bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <TrendUp01 className="size-4" />
              <span className="text-xs font-semibold tracking-wider uppercase">
                Earned
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold">$2,420</p>
          </div>
        </div>

        {/* Active Projects */}
        <div className="flex-1 space-y-3 rounded-2xl border border-border/40 p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <PieChart01 className="size-4" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Active Slices
            </span>
          </div>

          <div className="space-y-2">
            {[
              { name: 'LaunchFast', share: '12%', earnings: '$1,440' },
              { name: 'MetricFlow', share: '8%', earnings: '$640' },
              { name: 'DevTools Pro', share: '5%', earnings: '$340' },
            ].map((project) => (
              <div
                key={project.name}
                className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{project.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.share} of pool
                  </p>
                </div>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {project.earnings}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export const ContributorStatsPreview = memo(ContributorStatsPreviewComponent)
