'use client'

import { cn } from '@/lib/utils'

export interface AppTab<T extends string = string> {
  value: T
  label: string
  icon?: React.ComponentType<{ className?: string }>
  count?: number
}

interface AppTabsProps<T extends string> {
  tabs: AppTab<T>[]
  activeTab: T
  onTabChange: (tab: T) => void
  className?: string
}

export function AppTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  className,
}: AppTabsProps<T>) {
  return (
    <div className={cn('border-b border-border', className)}>
      <nav
        className="scrollbar-hide -mb-px flex gap-0.5 overflow-x-auto"
        aria-label="Tabs"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.value

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onTabChange(tab.value)}
              className={cn(
                'group relative flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors sm:gap-2 sm:px-4',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {Icon && <Icon className="size-4" />}
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-xs font-medium',
                    isActive
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground group-hover:bg-accent',
                  )}
                >
                  {tab.count}
                </span>
              )}

              {/* Active indicator */}
              {isActive && (
                <span className="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
