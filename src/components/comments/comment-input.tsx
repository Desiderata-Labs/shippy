'use client'

import { ArrowCircleUp } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { UploadFolder } from '@/lib/uploads/folders'
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
  /** Called when user starts editing (for canceling) */
  onCancel?: () => void
  /** Whether this is in edit mode */
  isEditing?: boolean
  /** Enable drag-drop/paste image uploads (images are inserted inline, not tracked as attachments) */
  enableUploads?: boolean
  /** Folder to upload files to (required if enableUploads is true) */
  uploadFolder?: UploadFolder
}

export function CommentInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Leave a comment...',
  isLoading = false,
  disabled = false,
  className,
  onCancel,
  isEditing = false,
  enableUploads = false,
  uploadFolder,
}: CommentInputProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle Cmd/Ctrl+Enter to submit, Escape to cancel
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && value.trim()) {
        e.preventDefault()
        onSubmit()
      }
      if (e.key === 'Escape' && onCancel) {
        e.preventDefault()
        onCancel()
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [value, onSubmit, onCancel])

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
      <div className={cn('px-4', isEditing ? 'pr-24' : 'pr-12')}>
        <MarkdownEditor
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          minHeight="60px"
          contentClassName="text-sm"
          hideMarkdownHint
          enableMentions
          enableUploads={enableUploads}
          uploadFolder={uploadFolder}
        />
      </div>
      <div className="absolute right-3 bottom-3 flex items-center gap-1">
        {isEditing && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="cursor-pointer rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim() || isLoading || disabled}
          className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          {isLoading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ArrowCircleUp className="size-5" />
          )}
        </button>
      </div>
    </div>
  )
}
