'use client'

import { Calendar, Wallet02 } from '@untitled-ui/icons-react'
import { AppInput } from '@/components/app'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export interface PayoutFixedBudgetFormData {
  periodLabel: string
  periodStart: string
  periodEnd: string
  distributionDollars: string
}

interface PayoutFixedBudgetFormProps {
  data: PayoutFixedBudgetFormData
  onChange: (data: Partial<PayoutFixedBudgetFormData>) => void
  budgetCents: number
  spentCents: number
  disabled?: boolean
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

/**
 * Form inputs for creating a FIXED_BUDGET payout.
 * Collects period info and distribution amount from budget.
 */
export function PayoutFixedBudgetForm({
  data,
  onChange,
  budgetCents,
  spentCents,
  disabled = false,
}: PayoutFixedBudgetFormProps) {
  const remainingCents = budgetCents - spentCents
  const remainingDollars = remainingCents / 100
  const distributionDollars = parseFloat(data.distributionDollars) || 0
  const isOverBudget = distributionDollars * 100 > remainingCents

  // Quick select percentages of remaining budget
  const quickSelectOptions = [
    { label: '25%', value: Math.floor(remainingDollars * 0.25) },
    { label: '50%', value: Math.floor(remainingDollars * 0.5) },
    { label: '75%', value: Math.floor(remainingDollars * 0.75) },
    { label: 'All', value: Math.floor(remainingDollars) },
  ]

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

      {/* Budget status */}
      <div className="border-b border-border bg-amber-500/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet02 className="size-3 text-amber-500" />
            Budget Status
          </div>
          <div className="text-right text-xs">
            <span className="font-semibold text-foreground">
              {formatCurrency(remainingCents)}
            </span>
            <span className="text-muted-foreground">
              {' '}
              remaining of {formatCurrency(budgetCents)}
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${Math.min((spentCents / budgetCents) * 100, 100)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{formatCurrency(spentCents)} spent</span>
          <span>{Math.round((spentCents / budgetCents) * 100)}% used</span>
        </div>
      </div>

      {/* Distribution amount input */}
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet02 className="size-3" />
          Distribution Amount
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl text-muted-foreground">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            max={remainingDollars}
            value={data.distributionDollars}
            onChange={(e) => onChange({ distributionDollars: e.target.value })}
            placeholder="0.00"
            required
            disabled={disabled}
            className={cn(
              'w-full bg-transparent text-3xl font-bold placeholder:text-muted-foreground/30 focus:outline-none',
              isOverBudget && 'text-destructive',
            )}
          />
        </div>
        {isOverBudget ? (
          <p className="mt-2 text-xs text-destructive">
            Amount exceeds remaining budget ({formatCurrency(remainingCents)})
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            How much to distribute from the budget pool
          </p>
        )}

        {/* Quick select buttons */}
        <div className="mt-3 flex flex-wrap gap-2">
          {quickSelectOptions.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() =>
                onChange({ distributionDollars: option.value.toString() })
              }
              disabled={disabled || option.value <= 0}
              className="rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {option.label} ({formatCurrency(option.value * 100)})
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

