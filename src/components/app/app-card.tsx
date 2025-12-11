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
 * App-styled card extending shadcn Card with subtle borders.
 */
const AppCard = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Card>
>(({ className, ...props }, ref) => (
  <Card
    ref={ref}
    className={cn('border-border/50 dark:border-white/10', className)}
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
