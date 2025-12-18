'use client'

import {
  CheckCircle,
  Circle,
  Clock,
  Contrast01,
  FilterLines,
  SlashCircle01,
  XClose,
} from '@untitled-ui/icons-react'
import { getLabelColor } from '@/lib/bounty/tag-colors'
import { BountyStatus } from '@/lib/db/types'
import { bountyStatusColors } from '@/lib/status-colors'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface Label {
  id: string
  name: string
  color: string
}

export interface BountyFiltersState {
  statuses: BountyStatus[]
  labelIds: string[]
}

interface BountyFiltersProps {
  labels: Label[]
  filters: BountyFiltersState
  onFiltersChange: (filters: BountyFiltersState) => void
  /** Status counts for display */
  statusCounts: Record<BountyStatus, number>
}

const STATUS_OPTIONS: Array<{
  value: BountyStatus
  label: string
  icon: React.ReactNode
  dotClass: string
}> = [
  {
    value: BountyStatus.OPEN,
    label: 'Open',
    icon: <Circle className="size-3.5" />,
    dotClass: bountyStatusColors.OPEN.dot,
  },
  {
    value: BountyStatus.CLAIMED,
    label: 'In Progress',
    icon: <Clock className="size-3.5" />,
    dotClass: bountyStatusColors.CLAIMED.dot,
  },
  {
    value: BountyStatus.COMPLETED,
    label: 'Completed',
    icon: <CheckCircle className="size-3.5" />,
    dotClass: bountyStatusColors.COMPLETED.dot,
  },
  {
    value: BountyStatus.BACKLOG,
    label: 'Backlog',
    icon: <Contrast01 className="size-3.5" />,
    dotClass: bountyStatusColors.BACKLOG.dot,
  },
  {
    value: BountyStatus.CLOSED,
    label: 'Closed',
    icon: <SlashCircle01 className="size-3.5" />,
    dotClass: bountyStatusColors.CLOSED.dot,
  },
]

export function BountyFilters({
  labels,
  filters,
  onFiltersChange,
  statusCounts,
}: BountyFiltersProps) {
  const hasActiveFilters =
    filters.statuses.length > 0 || filters.labelIds.length > 0
  const activeFilterCount = filters.statuses.length + filters.labelIds.length

  const toggleStatus = (status: BountyStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status]
    onFiltersChange({ ...filters, statuses: newStatuses })
  }

  const toggleLabel = (labelId: string) => {
    const newLabelIds = filters.labelIds.includes(labelId)
      ? filters.labelIds.filter((id) => id !== labelId)
      : [...filters.labelIds, labelId]
    onFiltersChange({ ...filters, labelIds: newLabelIds })
  }

  const removeStatus = (status: BountyStatus) => {
    onFiltersChange({
      ...filters,
      statuses: filters.statuses.filter((s) => s !== status),
    })
  }

  const removeLabel = (labelId: string) => {
    onFiltersChange({
      ...filters,
      labelIds: filters.labelIds.filter((id) => id !== labelId),
    })
  }

  const clearAll = () => {
    onFiltersChange({ statuses: [], labelIds: [] })
  }

  // Get label details for active label filters
  const activeLabels = labels.filter((l) => filters.labelIds.includes(l.id))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Filter button with popover */}
      <Popover>
        <PopoverTrigger asChild>
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
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <div className="space-y-3 p-3">
            {/* Status section */}
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Status
              </div>
              <div className="space-y-1">
                {STATUS_OPTIONS.map((option) => {
                  const count = statusCounts[option.value] ?? 0
                  const isChecked = filters.statuses.includes(option.value)
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                        count === 0 && 'opacity-50',
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleStatus(option.value)}
                        disabled={count === 0}
                        className="size-3.5"
                      />
                      <span
                        className={cn('size-2 rounded-full', option.dotClass)}
                      />
                      <span className="flex-1">{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {count}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Labels section */}
            {labels.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  Labels
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {labels.map((label) => {
                    const color = getLabelColor(label.color)
                    const isChecked = filters.labelIds.includes(label.id)
                    return (
                      <label
                        key={label.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleLabel(label.id)}
                          className="size-3.5"
                        />
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: color.dot }}
                        />
                        <span className="flex-1 truncate">{label.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Clear all footer */}
          {hasActiveFilters && (
            <div className="border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={clearAll}
                className="w-full cursor-pointer rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Clear all filters
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

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

      {activeLabels.map((label) => {
        const color = getLabelColor(label.color)
        return (
          <FilterChip
            key={label.id}
            onRemove={() => removeLabel(label.id)}
            dotColor={color.dot}
          >
            {label.name}
          </FilterChip>
        )
      })}

      {/* Clear all button (outside popover, when filters active) */}
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
  dotColor,
}: {
  children: React.ReactNode
  onRemove: () => void
  dotClass?: string
  dotColor?: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-accent/50 py-0.5 pr-1 pl-2 text-xs font-medium">
      {dotClass && <span className={cn('size-2 rounded-full', dotClass)} />}
      {dotColor && (
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      )}
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
