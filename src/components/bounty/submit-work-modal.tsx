'use client'

import { FileCheck03 } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { AppButton } from '@/components/app'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Markdown } from '@/components/ui/markdown'
import { MarkdownEditor } from '@/components/ui/markdown-editor'

interface SubmitWorkModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (description: string) => Promise<void>
  evidenceDescription?: string | null
  isLoading?: boolean
  /** For edit mode - pre-fill with existing description */
  initialDescription?: string
  /** Modal mode - affects title and button text */
  mode?: 'create' | 'edit'
}

export function SubmitWorkModal({
  open,
  onClose,
  onSubmit,
  evidenceDescription,
  isLoading = false,
  initialDescription = '',
  mode = 'create',
}: SubmitWorkModalProps) {
  const [description, setDescription] = useState(initialDescription)
  // Track previous values to detect when we need to reset (React recommended pattern)
  const [prevOpen, setPrevOpen] = useState(open)
  const [prevInitial, setPrevInitial] = useState(initialDescription)

  // Reset form when modal opens or initialDescription changes
  // This pattern is recommended by React docs for adjusting state based on props
  if (open !== prevOpen || initialDescription !== prevInitial) {
    setPrevOpen(open)
    setPrevInitial(initialDescription)
    if (open && (!prevOpen || initialDescription !== prevInitial)) {
      setDescription(initialDescription)
    }
  }

  const handleSubmit = async () => {
    if (!description.trim()) return
    await onSubmit(description)
    if (mode === 'create') {
      setDescription('')
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      onClose()
      if (mode === 'create') {
        setDescription('')
      }
    }
  }

  const isEdit = mode === 'edit'
  const hasChanges = description !== initialDescription
  const isValid = description.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-lg">
            {isEdit ? 'Edit Submission' : 'Submit Your Work'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update your submission. All edits are tracked for transparency.'
              : "Describe what you've accomplished and provide evidence."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Acceptance Criteria (only show for create mode) */}
          {!isEdit && evidenceDescription && (
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

          {/* Description editor */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Description
            </label>
            <div className="rounded-lg border border-border bg-background px-4">
              <MarkdownEditor
                value={description}
                onChange={setDescription}
                placeholder="Describe what you did, how it meets the requirements, and include any relevant links or notes..."
                disabled={isLoading}
                minHeight="280px"
                contentClassName="text-sm"
              />
            </div>
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
            disabled={isLoading || !isValid || (isEdit && !hasChanges)}
          >
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Submit Work'}
          </AppButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
