'use client'

import { BankNote01, Clock, Target01 } from '@untitled-ui/icons-react'
import { memo } from 'react'

const BountyCardPreviewComponent = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-background via-background to-muted/25 px-6 pt-6">
      <div className="flex size-full max-w-[360px] flex-col gap-4 overflow-hidden rounded-t-[28px] rounded-b-none border border-border/40 bg-background/98 shadow-[0_24px_48px_rgba(15,23,42,0.12)] ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <div className="flex items-center gap-2">
            <Target01 className="size-4 text-primary" />
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Bounty
            </span>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Open
          </span>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-4 px-5">
          <div>
            <h4 className="text-base leading-tight font-semibold">
              Build an onboarding flow for new users
            </h4>
            <p className="mt-2 text-sm text-muted-foreground">
              Design and implement a 3-step onboarding experience that improves
              activation rates.
            </p>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <BankNote01 className="size-4 text-primary" />
              <span className="font-semibold text-foreground">500 pts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-4" />
              <span>3 days</span>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-auto pb-5">
            <div className="flex items-center gap-3 rounded-xl bg-primary/10 p-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Target01 className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Claim this bounty</p>
                <p className="text-xs text-muted-foreground">
                  7 days to complete
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const BountyCardPreview = memo(BountyCardPreviewComponent)
