'use client'

import { BankNote03, Calendar, Wallet02 } from '@untitled-ui/icons-react'
import { PoolType } from '@/lib/db/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

interface PayoutDetailHeaderProps {
  periodLabel: string
  periodStart: Date | string
  periodEnd: Date | string
  status: { label: string; color: string }
  poolType: string
  reportedProfitCents: number
  poolAmountCents: number
  poolPercentage: number
  canSeeFinancials: boolean
}

/**
 * Header card for payout detail page.
 * Shows period info and pool-type-specific financial summary.
 */
export function PayoutDetailHeader({
  periodLabel,
  periodStart,
  periodEnd,
  status,
  poolType,
  reportedProfitCents,
  poolAmountCents,
  poolPercentage,
  canSeeFinancials,
}: PayoutDetailHeaderProps) {
  const isFixedBudget = poolType === PoolType.FIXED_BUDGET

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="size-3" />
              Payout Period
            </div>
            <h1 className="text-2xl font-bold">{periodLabel}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(periodStart).toLocaleDateString()} –{' '}
              {new Date(periodEnd).toLocaleDateString()}
            </p>
          </div>
          <Badge variant="outline" className={cn('text-xs', status.color)}>
            {status.label}
          </Badge>
        </div>
      </div>

      {canSeeFinancials && (
        <>
          <Separator />

          <div className="p-4">
            {isFixedBudget ? (
              // FIXED_BUDGET: Show distribution amount
              <>
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Wallet02 className="size-3" />
                  Distribution Amount
                </div>
                <div className="text-3xl font-bold">
                  {formatCurrency(poolAmountCents)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  From fixed budget pool
                </p>
              </>
            ) : (
              // PROFIT_SHARE: Show reported profit and share calculation
              <>
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <BankNote03 className="size-3" />
                  Reported Profit
                </div>
                <div className="text-3xl font-bold">
                  {formatCurrency(reportedProfitCents)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Profit share: {formatCurrency(poolAmountCents)} (
                  {poolPercentage}% of profit)
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

