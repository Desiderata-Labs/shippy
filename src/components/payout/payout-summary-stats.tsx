'use client'

import { PoolType } from '@/lib/db/types'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function formatPercentage(value: number): string {
  return value.toFixed(1) + '%'
}

interface PayoutSummaryStatsProps {
  poolType: string
  poolAmountCents: number
  poolPercentage: number
  poolCapacity: number
  totalEarnedPoints: number
  distributedAmountCents: number
  recipientCount: number
  budgetInfo?: {
    budgetCents: number
    spentCents: number
    remainingCents: number
  } | null
}

/**
 * Summary statistics for a payout, displayed in a grid.
 * Adapts based on pool type.
 */
export function PayoutSummaryStats({
  poolType,
  poolAmountCents,
  poolPercentage,
  poolCapacity,
  totalEarnedPoints,
  distributedAmountCents,
  recipientCount,
  budgetInfo,
}: PayoutSummaryStatsProps) {
  const poolUtilization =
    poolCapacity > 0 ? (totalEarnedPoints / poolCapacity) * 100 : 0

  if (poolType === PoolType.FIXED_BUDGET) {
    // FIXED_BUDGET: Show distribution amount and budget status
    const remainingAfter = budgetInfo
      ? budgetInfo.remainingCents - poolAmountCents
      : 0

    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Distribution Amount</div>
          <div className="text-lg font-semibold">
            {formatCurrency(poolAmountCents)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            From budget pool
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Pool Utilization</div>
          <div className="text-lg font-semibold">
            {formatPercentage(Math.min(poolUtilization, 100))}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {totalEarnedPoints} / {poolCapacity} pts
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">To Distribute</div>
          <div className="text-lg font-semibold text-primary">
            {formatCurrency(distributedAmountCents)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            to {recipientCount} contributor{recipientCount !== 1 ? 's' : ''}
          </div>
        </div>
        {budgetInfo && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 sm:col-span-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">After this payout:</span>
              <span className="font-semibold">
                {formatCurrency(remainingAfter)} remaining of{' '}
                {formatCurrency(budgetInfo.budgetCents)} budget
              </span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // PROFIT_SHARE: Show profit share amount and percentage
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="text-xs text-muted-foreground">Profit Share Amount</div>
        <div className="text-lg font-semibold">
          {formatCurrency(poolAmountCents)}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {poolPercentage}% of profit
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="text-xs text-muted-foreground">
          Profit Share Utilization
        </div>
        <div className="text-lg font-semibold">
          {formatPercentage(Math.min(poolUtilization, 100))}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {totalEarnedPoints} / {poolCapacity} pts
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="text-xs text-muted-foreground">To Distribute</div>
        <div className="text-lg font-semibold text-primary">
          {formatCurrency(distributedAmountCents)}
        </div>
        <div className="text-[10px] text-muted-foreground">
          to {recipientCount} contributor{recipientCount !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}

