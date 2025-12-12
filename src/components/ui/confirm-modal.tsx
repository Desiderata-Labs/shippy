'use client'

import { Loader2 } from 'lucide-react'
import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'default'
  isLoading?: boolean
  /** Custom content to display between description and buttons */
  content?: ReactNode
  /** Fully custom children - replaces the entire content including buttons */
  children?: ReactNode
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Yes',
  cancelText = 'No',
  variant = 'destructive',
  isLoading = false,
  content,
  children,
}: ConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[480px]">
        <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">
          {description}
        </DialogDescription>
        {children ? (
          children
        ) : (
          <>
            {content && <div className="mt-4">{content}</div>}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <Button
                onClick={onClose}
                variant="secondary"
                disabled={isLoading}
              >
                {cancelText}
              </Button>
              <Button
                variant={variant}
                onClick={onConfirm}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  confirmText
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
