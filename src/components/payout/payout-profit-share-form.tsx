'use client'

import { BankNote03, Calendar } from '@untitled-ui/icons-react'
import { AppInput } from '@/components/app'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

export interface PayoutProfitShareFormData {
  periodLabel: string
  periodStart: string
  periodEnd: string
  profitDollars: string
}

interface PayoutProfitShareFormProps {
  data: PayoutProfitShareFormData
  onChange: (data: Partial<PayoutProfitShareFormData>) => void
  poolPercentage: number
  disabled?: boolean
}

/**
 * Form inputs for creating a PROFIT_SHARE payout.
 * Collects period info and reported profit amount.
 */
export function PayoutProfitShareForm({
  data,
  onChange,
  poolPercentage,
  disabled = false,
}: PayoutProfitShareFormProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Period label - inline style like bounty title */}
      <div className="px-4 py-3">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="size-3" />
          Period Label
        </div>
        <input
          type="text"
          value={data.periodLabel}
          onChange={(e) => onChange({ periodLabel: e.target.value })}
          placeholder="e.g., December 2024 or Q4 2024"
          required
          disabled={disabled}
          className="w-full bg-transparent text-xl font-semibold placeholder:text-muted-foreground/50 focus:outline-none"
        />
      </div>

      <Separator />

      {/* Date range */}
      <div className="px-4 py-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="periodStart"
              className="text-xs text-muted-foreground"
            >
              Start Date
            </Label>
            <AppInput
              id="periodStart"
              type="date"
              value={data.periodStart}
              onChange={(e) => onChange({ periodStart: e.target.value })}
              required
              disabled={disabled}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="periodEnd"
              className="text-xs text-muted-foreground"
            >
              End Date
            </Label>
            <AppInput
              id="periodEnd"
              type="date"
              value={data.periodEnd}
              onChange={(e) => onChange({ periodEnd: e.target.value })}
              required
              disabled={disabled}
              className="h-9"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Profit input - prominent */}
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <BankNote03 className="size-3" />
          Reported Profit
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl text-muted-foreground">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={data.profitDollars}
            onChange={(e) => onChange({ profitDollars: e.target.value })}
            placeholder="0.00"
            required
            disabled={disabled}
            className="w-full bg-transparent text-3xl font-bold placeholder:text-muted-foreground/30 focus:outline-none"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The profit share ({poolPercentage}%) will be calculated from this
          amount
        </p>
      </div>
    </div>
  )
}

