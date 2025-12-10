'use client'

import { BankNote01, CheckCircle } from '@untitled-ui/icons-react'
import { memo } from 'react'

const contributors = [
  { name: 'Sarah Chen', points: 2400, share: '48%', amount: '$480' },
  { name: 'Alex Rivera', points: 1500, share: '30%', amount: '$300' },
  { name: 'Jordan Kim', points: 600, share: '12%', amount: '$120' },
]

const PayoutPreviewComponent = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="flex h-full w-full max-w-[360px] flex-col gap-4 rounded-[28px] border border-border/40 bg-background/95 p-5 shadow-[0_24px_48px_rgba(15,23,42,0.12)] ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              March Payout
            </span>
            <p className="text-2xl font-bold">$1,000</p>
          </div>
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
            <BankNote01 className="size-6 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        {/* Contributors */}
        <div className="flex-1 space-y-2 rounded-2xl border border-border/40 bg-muted/20 p-4">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Distribution
          </p>

          <div className="space-y-3">
            {contributors.map((c, i) => (
              <div key={c.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{
                      backgroundColor:
                        i === 0
                          ? 'hsl(var(--primary))'
                          : i === 1
                            ? 'hsl(var(--accent))'
                            : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {c.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.points.toLocaleString()} pts · {c.share}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{c.amount}</span>
                  <CheckCircle className="size-4 text-emerald-500" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 p-3">
          <CheckCircle className="size-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            All payouts confirmed
          </span>
        </div>
      </div>
    </div>
  )
}

export const PayoutPreview = memo(PayoutPreviewComponent)
