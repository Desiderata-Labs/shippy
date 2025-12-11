import * as React from 'react'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'

/**
 * App-styled textarea extending shadcn Textarea.
 */
const AppTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<typeof Textarea>
>(({ className, ...props }, ref) => (
  <Textarea
    ref={ref}
    className={cn('rounded-xl border-border bg-card px-4 py-3', className)}
    {...props}
  />
))
AppTextarea.displayName = 'AppTextarea'

export { AppTextarea }
