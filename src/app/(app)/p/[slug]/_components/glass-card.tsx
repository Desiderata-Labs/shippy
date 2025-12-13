import { cn } from '@/lib/utils'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

/**
 * Glassmorphism card with frosted glass effect.
 * Used throughout the project detail page for consistent styling.
 */
export function GlassCard({
  children,
  className,
  hover = false,
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'isolate rounded-xl p-4 backdrop-blur-xl',
        hover &&
          'transition-colors duration-200 hover:bg-card/60 hover:shadow-lg',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface GlassCardHeaderProps {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
}

export function GlassCardHeader({
  icon: Icon,
  title,
  description,
  action,
}: GlassCardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        {Icon && (
          <div className="flex size-6 items-center justify-center rounded-sm bg-muted">
            <Icon className="size-3.5 text-foreground opacity-50" />
          </div>
        )}
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}
