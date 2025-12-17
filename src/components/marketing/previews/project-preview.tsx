'use client'

import { BankNote03, CheckVerified01, Users01 } from '@untitled-ui/icons-react'
import { memo } from 'react'

const ProjectPreviewComponent = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-background via-background to-muted/25 px-6 pt-6">
      <div className="flex size-full max-w-[360px] flex-col overflow-hidden rounded-t-[28px] rounded-b-none border border-border/40 bg-background/98 shadow-[0_24px_48px_rgba(15,23,42,0.12)] ring-1 ring-black/5">
        {/* Hero Banner */}
        <div className="relative h-20 bg-linear-to-r from-primary via-primary/80 to-accent">
          <div className="absolute -bottom-6 left-5">
            <div className="flex size-14 items-center justify-center rounded-2xl border-4 border-background bg-white text-xl font-bold text-primary shadow-lg">
              LF
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-4 px-5 pt-10 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-bold">LaunchFast</h4>
              <CheckVerified01 className="size-5 text-primary" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              The fastest way to ship your SaaS. We need help with design,
              development, and distribution.
            </p>
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Users01 className="size-4 text-muted-foreground" />
              <span className="font-medium">12 contributors</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BankNote03 className="size-4 text-primary" />
              <span className="font-semibold text-primary">$18k paid</span>
            </div>
          </div>

          {/* Profit Share Info */}
          <div className="mt-auto rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                  Profit Share
                </p>
                <p className="mt-1 text-lg font-bold">10% of profit</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Open bounties</p>
                <p className="text-lg font-bold">8</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const ProjectPreview = memo(ProjectPreviewComponent)
