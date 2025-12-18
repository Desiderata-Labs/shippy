'use client'

import {
  CheckCircle,
  Circle,
  Clock,
  Contrast01,
  FilterLines,
  SlashCircle01,
  Tag01,
  XClose,
} from '@untitled-ui/icons-react'
import { getLabelColor } from '@/lib/bounty/tag-colors'
import { BountyStatus } from '@/lib/db/types'
import { bountyStatusColors } from '@/lib/status-colors'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { BountyFiltersState } from './use-bounty-filters'

interface Label {
  id: string
  name: string
  color: string
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

  // Count selected in each category
  const selectedStatusCount = filters.statuses.length
  const selectedLabelCount = filters.labelIds.length

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
          {/* Status submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Circle className="size-3.5" />
              <span className="flex-1">Status</span>
              {selectedStatusCount > 0 && (
                <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  {selectedStatusCount}
                </span>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
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
                    <span
                      className={cn('size-2 rounded-full', option.dotClass)}
                    />
                    <span className="flex-1">{option.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {count}
                    </span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Labels submenu */}
          {labels.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <Tag01 className="size-3.5" />
                <span className="flex-1">Labels</span>
                {selectedLabelCount > 0 && (
                  <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {selectedLabelCount}
                  </span>
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-64 w-48 overflow-y-auto">
                {labels.map((label) => {
                  const color = getLabelColor(label.color)
                  const isChecked = filters.labelIds.includes(label.id)
                  return (
                    <DropdownMenuItem
                      key={label.id}
                      onClick={(e) => {
                        e.preventDefault()
                        toggleLabel(label.id)
                      }}
                      className="cursor-pointer"
                    >
                      <Checkbox
                        checked={isChecked}
                        className="pointer-events-none size-3.5"
                      />
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: color.dot }}
                      />
                      <span className="flex-1 truncate">{label.name}</span>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

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
