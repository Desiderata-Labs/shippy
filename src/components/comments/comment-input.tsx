'use client'

import { ArrowCircleUp } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommentInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  isLoading?: boolean
  disabled?: boolean
  className?: string
}

export function CommentInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Leave a comment...',
  isLoading = false,
  disabled = false,
  className,
}: CommentInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && value.trim()) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div
      className={cn(
        'relative rounded-lg border border-border bg-background',
        className,
      )}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={3}
        disabled={disabled || isLoading}
        className="w-full resize-none bg-transparent px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!value.trim() || isLoading || disabled}
        className="absolute right-3 bottom-3 cursor-pointer text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
      >
        {isLoading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <ArrowCircleUp className="size-5" />
        )}
      </button>
    </div>
  )
}
