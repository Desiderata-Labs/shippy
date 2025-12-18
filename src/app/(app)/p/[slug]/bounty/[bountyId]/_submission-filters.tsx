'use client'

import {
  CheckCircle,
  Clock,
  FilterLines,
  MessageTextSquare02,
  SlashCircle01,
  XCircle,
  XClose,
} from '@untitled-ui/icons-react'
import { SubmissionStatus } from '@/lib/db/types'
import { submissionStatusColors } from '@/lib/status-colors'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SubmissionFiltersState } from './use-submission-filters'

interface SubmissionFiltersProps {
  filters: SubmissionFiltersState
  onFiltersChange: (filters: SubmissionFiltersState) => void
  statusCounts: Record<SubmissionStatus, number>
}

const STATUS_OPTIONS: Array<{
  value: SubmissionStatus
  label: string
  icon: React.ReactNode
  dotClass: string
}> = [
  {
    value: SubmissionStatus.PENDING,
    label: 'Pending',
    icon: <Clock className="size-3.5" />,
    dotClass: submissionStatusColors.PENDING.dot,
  },
  {
    value: SubmissionStatus.NEEDS_INFO,
    label: 'Needs Info',
    icon: <MessageTextSquare02 className="size-3.5" />,
    dotClass: submissionStatusColors.NEEDS_INFO.dot,
  },
  {
    value: SubmissionStatus.APPROVED,
    label: 'Approved',
    icon: <CheckCircle className="size-3.5" />,
    dotClass: submissionStatusColors.APPROVED.dot,
  },
  {
    value: SubmissionStatus.REJECTED,
    label: 'Rejected',
    icon: <XCircle className="size-3.5" />,
    dotClass: submissionStatusColors.REJECTED.dot,
  },
  {
    value: SubmissionStatus.WITHDRAWN,
    label: 'Withdrawn',
    icon: <SlashCircle01 className="size-3.5" />,
    dotClass: submissionStatusColors.WITHDRAWN.dot,
  },
]

export function SubmissionFilters({
  filters,
  onFiltersChange,
  statusCounts,
}: SubmissionFiltersProps) {
  const hasActiveFilters = filters.statuses.length > 0
  const activeFilterCount = filters.statuses.length

  const toggleStatus = (status: SubmissionStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status]
    onFiltersChange({ ...filters, statuses: newStatuses })
  }

  const removeStatus = (status: SubmissionStatus) => {
    onFiltersChange({
      ...filters,
      statuses: filters.statuses.filter((s) => s !== status),
    })
  }

  const clearAll = () => {
    onFiltersChange({ statuses: [] })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Filter dropdown menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
              hasActiveFilters
                ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <FilterLines className="size-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <span className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {STATUS_OPTIONS.map((option) => {
            const count = statusCounts[option.value] ?? 0
            const isChecked = filters.statuses.includes(option.value)
            return (
              <DropdownMenuItem
                key={option.value}
                onClick={(e) => {
                  e.preventDefault()
                  toggleStatus(option.value)
                }}
                disabled={count === 0}
                className="cursor-pointer"
              >
                <Checkbox
                  checked={isChecked}
                  className="pointer-events-none size-3.5"
                />
                <span className={cn('size-2 rounded-full', option.dotClass)} />
                <span className="flex-1">{option.label}</span>
                <span className="text-xs text-muted-foreground">{count}</span>
              </DropdownMenuItem>
            )
          })}

          {/* Clear all option */}
          {hasActiveFilters && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={clearAll} className="cursor-pointer">
                <XClose className="size-3.5" />
                Clear all filters
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Active filter chips */}
      {filters.statuses.map((status) => {
        const option = STATUS_OPTIONS.find((o) => o.value === status)
        if (!option) return null
        return (
          <FilterChip
            key={status}
            onRemove={() => removeStatus(status)}
            dotClass={option.dotClass}
          >
            {option.label}
          </FilterChip>
        )
      })}

      {/* Clear all button (outside dropdown, when filters active) */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  )
}

function FilterChip({
  children,
  onRemove,
  dotClass,
}: {
  children: React.ReactNode
  onRemove: () => void
  dotClass: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-accent/50 py-0.5 pr-1 pl-2 text-xs font-medium">
      <span className={cn('size-2 rounded-full', dotClass)} />
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="cursor-pointer rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <XClose className="size-3" />
      </button>
    </span>
  )
}
