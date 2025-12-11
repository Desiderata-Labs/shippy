import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * App-styled card with glassmorphism effect.
 */
const AppCard = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Card>
>(({ className, ...props }, ref) => (
  <Card
    ref={ref}
    className={cn(
      'isolate border-0 bg-card/50 shadow-lg ring-1 ring-border backdrop-blur-xl',
      className,
    )}
    {...props}
  />
))
AppCard.displayName = 'AppCard'

// Re-export the other card components unchanged
export {
  AppCard,
  CardHeader as AppCardHeader,
  CardTitle as AppCardTitle,
  CardDescription as AppCardDescription,
  CardContent as AppCardContent,
  CardFooter as AppCardFooter,
}
