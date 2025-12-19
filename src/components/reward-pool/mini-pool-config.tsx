'use client'

import { Calendar, Clock, PieChart01, Wallet02 } from '@untitled-ui/icons-react'
import * as React from 'react'
import { CommitmentMonths, PayoutFrequency, PoolType } from '@/lib/db/types'
import { cn } from '@/lib/utils'
import { AppInput } from '@/components/app'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// Pool type configuration
const poolTypeConfig = {
  [PoolType.PROFIT_SHARE]: {
    label: 'Profit Share',
    description: 'Share a % of profit periodically',
    icon: PieChart01,
    color: 'border-primary/50 bg-primary/5',
  },
  [PoolType.FIXED_BUDGET]: {
    label: 'Fixed Budget',
    description: 'Set a fixed $ budget for bounties',
    icon: Wallet02,
    color: 'border-amber-500/50 bg-amber-500/5',
  },
}

const commitmentLabel: Record<CommitmentMonths, string> = {
  [CommitmentMonths.SIX_MONTHS]: '6 months',
  [CommitmentMonths.ONE_YEAR]: '1 year',
  [CommitmentMonths.TWO_YEARS]: '2 years',
  [CommitmentMonths.THREE_YEARS]: '3 years',
  [CommitmentMonths.FIVE_YEARS]: '5 years',
  [CommitmentMonths.TEN_YEARS]: '10 years',
  [CommitmentMonths.FOREVER]: 'Forever',
}

// Shared state interface for pool configuration
export interface PoolConfigState {
  poolType: PoolType
  // PROFIT_SHARE fields
  poolPercentage: number
  payoutFrequency: PayoutFrequency
  commitmentMonths: CommitmentMonths
  // FIXED_BUDGET fields
  budgetDollars: number
}

interface MiniPoolConfigProps {
  state: PoolConfigState
  onChange: (updates: Partial<PoolConfigState>) => void
  disabled?: boolean
  /** If true, shows pool type selector */
  showPoolTypePicker?: boolean
}

/**
 * Mini pool configuration component for sidebars.
 * Used in project creation and potentially bounty creation.
 */
export function MiniPoolConfig({
  state,
  onChange,
  disabled = false,
  showPoolTypePicker = true,
}: MiniPoolConfigProps) {
  const {
    poolType,
    poolPercentage,
    payoutFrequency,
    commitmentMonths,
    budgetDollars,
  } = state

  return (
    <div className="space-y-4">
      {/* Pool Type Selector */}
      {showPoolTypePicker && (
        <>
          <span className="text-xs font-medium text-muted-foreground">
            Pool Type
          </span>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(poolTypeConfig).map(([type, config]) => {
              const Icon = config.icon
              const isSelected = poolType === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onChange({ poolType: type as PoolType })}
                  disabled={disabled}
                  className={cn(
                    'flex flex-col items-start rounded-lg border-2 p-2.5 text-left transition-all',
                    isSelected
                      ? config.color
                      : 'border-border hover:border-muted-foreground/50',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-4',
                      isSelected ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  />
                  <span className="mt-1.5 text-xs font-medium">
                    {config.label}
                  </span>
                </button>
              )
            })}
          </div>
          <Separator />
        </>
      )}

      {/* PROFIT_SHARE Configuration */}
      {poolType === PoolType.PROFIT_SHARE && (
        <>
          <span className="text-xs font-medium text-muted-foreground">
            Profit Share Settings
          </span>

          {/* Pool Percentage */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart01 className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Profit share
                </span>
              </div>
              <div className="flex items-center">
                <AppInput
                  type="number"
                  min="1"
                  max="100"
                  value={poolPercentage || ''}
                  onChange={(e) =>
                    onChange({ poolPercentage: parseInt(e.target.value) || 0 })
                  }
                  onBlur={() => {
                    if (poolPercentage < 1) onChange({ poolPercentage: 1 })
                    if (poolPercentage > 100) onChange({ poolPercentage: 100 })
                  }}
                  disabled={disabled}
                  className="h-7 w-20 text-center text-sm font-semibold"
                />
                <span className="ml-1 text-sm text-muted-foreground">%</span>
              </div>
            </div>

            {/* Slider */}
            <Slider
              value={[poolPercentage]}
              onValueChange={([value]) => onChange({ poolPercentage: value })}
              min={1}
              max={50}
              step={1}
              disabled={disabled}
              className="py-1"
            />

            {/* Quick selects */}
            <div className="flex flex-wrap gap-1">
              {[5, 10, 15, 20].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange({ poolPercentage: preset })}
                  disabled={disabled}
                  className={cn(
                    'cursor-pointer rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                    poolPercentage === preset
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted',
                  )}
                >
                  {preset}%
                </button>
              ))}
            </div>

            {/* Example info */}
            <div className="rounded-md bg-primary/5 px-3 py-2 text-xs">
              <span className="whitespace-nowrap text-muted-foreground">
                e.g. ${((10000 * poolPercentage) / 100).toLocaleString()} of
                $10,000 profit → contributors
              </span>
            </div>
          </div>

          <Separator />

          {/* Payout Frequency */}
          <div className="flex items-center justify-between">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-help items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  Payout Frequency
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-wrap">
                How often you&apos;ll run payouts to contributors
              </TooltipContent>
            </Tooltip>
            <Select
              value={payoutFrequency}
              onValueChange={(v: PayoutFrequency) =>
                onChange({ payoutFrequency: v })
              }
              disabled={disabled}
            >
              <SelectTrigger className="h-7 w-24 rounded-md border-border text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PayoutFrequency.MONTHLY}>Monthly</SelectItem>
                <SelectItem value={PayoutFrequency.QUARTERLY}>
                  Quarterly
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Commitment Period */}
          <div className="flex items-center justify-between">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-help items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="size-3" />
                  Commitment
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-wrap">
                How long you commit to running the pool and paying contributors
              </TooltipContent>
            </Tooltip>
            <Select
              value={commitmentMonths}
              onValueChange={(v: CommitmentMonths) =>
                onChange({ commitmentMonths: v })
              }
              disabled={disabled}
            >
              <SelectTrigger className="h-7 w-24 rounded-md border-border text-xs">
                <SelectValue>{commitmentLabel[commitmentMonths]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CommitmentMonths.SIX_MONTHS}>
                  6 months
                </SelectItem>
                <SelectItem value={CommitmentMonths.ONE_YEAR}>
                  1 year
                </SelectItem>
                <SelectItem value={CommitmentMonths.TWO_YEARS}>
                  2 years
                </SelectItem>
                <SelectItem value={CommitmentMonths.THREE_YEARS}>
                  3 years
                </SelectItem>
                <SelectItem value={CommitmentMonths.FIVE_YEARS}>
                  5 years
                </SelectItem>
                <SelectItem value={CommitmentMonths.TEN_YEARS}>
                  10 years
                </SelectItem>
                <SelectItem value={CommitmentMonths.FOREVER}>
                  Forever
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />
        </>
      )}

      {/* FIXED_BUDGET Configuration */}
      {poolType === PoolType.FIXED_BUDGET && (
        <>
          <span className="text-xs font-medium text-muted-foreground">
            Budget Settings
          </span>

          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet02 className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Total Budget
                </span>
              </div>
              <div className="relative">
                <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <AppInput
                  type="number"
                  value={budgetDollars}
                  onChange={(e) =>
                    onChange({ budgetDollars: parseFloat(e.target.value) || 0 })
                  }
                  min={1}
                  step="any"
                  disabled={disabled}
                  className="h-7 w-28 pl-6 text-right text-sm font-semibold"
                />
              </div>
            </div>

            {/* Quick selects */}
            <div className="flex flex-wrap gap-1">
              {[1000, 5000, 10000, 25000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange({ budgetDollars: preset })}
                  disabled={disabled}
                  className={cn(
                    'cursor-pointer rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                    budgetDollars === preset
                      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted',
                  )}
                >
                  ${(preset / 1000).toLocaleString()}k
                </button>
              ))}
            </div>

            {/* Info */}
            <div className="rounded-md bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              Contributors earn fixed $ rewards per bounty. Pool closes when
              budget is exhausted.
            </div>
          </div>

          <Separator />
        </>
      )}
    </div>
  )
}

/**
 * Hook to create initial pool config state with defaults
 */
export function usePoolConfigState(
  initialPoolType: PoolType = PoolType.PROFIT_SHARE,
): [PoolConfigState, (updates: Partial<PoolConfigState>) => void] {
  const [state, setState] = React.useState<PoolConfigState>({
    poolType: initialPoolType,
    poolPercentage: 10,
    payoutFrequency: PayoutFrequency.MONTHLY,
    commitmentMonths: CommitmentMonths.FIVE_YEARS,
    budgetDollars: 5000,
  })

  const updateState = React.useCallback((updates: Partial<PoolConfigState>) => {
    setState((prev) => ({ ...prev, ...updates }))
  }, [])

  return [state, updateState]
}
