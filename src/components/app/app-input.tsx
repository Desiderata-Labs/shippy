import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

/**
 * App-styled input extending shadcn Input with rounded-xl corners and custom borders.
 */
const AppInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => (
  <Input
    ref={ref}
    className={cn(
      'h-10 rounded-xl border-border/50 px-4 dark:border-white/10 dark:bg-card',
      className,
    )}
    {...props}
  />
))
AppInput.displayName = 'AppInput'

export { AppInput }
