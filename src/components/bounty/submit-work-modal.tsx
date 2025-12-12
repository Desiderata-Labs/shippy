'use client'

import { FileCheck03 } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { AppButton, AppTextarea } from '@/components/app'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Markdown } from '@/components/ui/markdown'

interface SubmitWorkModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (description: string) => Promise<void>
  evidenceDescription?: string | null
  isLoading?: boolean
}

export function SubmitWorkModal({
  open,
  onClose,
  onSubmit,
  evidenceDescription,
  isLoading = false,
}: SubmitWorkModalProps) {
  const [description, setDescription] = useState('')

  const handleSubmit = async () => {
    if (!description.trim()) return
    await onSubmit(description)
    setDescription('')
  }

  const handleClose = () => {
    if (!isLoading) {
      onClose()
      setDescription('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-lg">Submit Your Work</DialogTitle>
          <DialogDescription>
            Describe what you&apos;ve accomplished and provide evidence.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Acceptance Criteria */}
          {evidenceDescription && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex gap-3">
                <FileCheck03 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Acceptance Criteria</p>
                  <Markdown
                    markdown={evidenceDescription}
                    proseSize="sm"
                    className="mt-1 text-muted-foreground"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Description textarea */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Description
            </label>
            <AppTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you did, how it meets the requirements, and include any relevant links or notes..."
              rows={12}
              disabled={isLoading}
              className="min-h-[280px] resize-y font-mono text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isLoading}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <AppButton
            onClick={handleSubmit}
            disabled={isLoading || !description.trim()}
          >
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Submit Work
          </AppButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
