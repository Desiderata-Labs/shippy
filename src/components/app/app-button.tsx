import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'

/**
 * App-styled button extending shadcn Button.
 */
const AppButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant, ...props }, ref) => (
  <Button
    ref={ref}
    variant={variant}
    className={cn(
      'cursor-pointer rounded-lg',
      // Override outline variant border styling
      variant === 'outline' &&
        'border-border bg-card hover:bg-accent dark:border-border',
      className,
    )}
    {...props}
  />
))
AppButton.displayName = 'AppButton'

export { AppButton, buttonVariants as appButtonVariants }
