'use client'

import { ArrowCircleUp } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { MarkdownEditor } from '@/components/ui/markdown-editor'

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
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle Cmd/Ctrl+Enter to submit
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && value.trim()) {
        e.preventDefault()
        onSubmit()
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [value, onSubmit])

  const handleChange = useCallback(
    (newValue: string) => {
      onChange(newValue)
    },
    [onChange],
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative rounded-lg border border-border bg-background',
        className,
      )}
    >
      <div className="px-4 pr-12">
        <MarkdownEditor
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          minHeight="60px"
          contentClassName="text-sm"
          hideMarkdownHint
        />
      </div>
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
