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
        'border-border/50 dark:border-white/10 dark:bg-card dark:hover:bg-white/5',
      className,
    )}
    {...props}
  />
))
AppButton.displayName = 'AppButton'

export { AppButton, buttonVariants as appButtonVariants }
