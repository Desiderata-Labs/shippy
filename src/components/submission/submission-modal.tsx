'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { FileCheck03 } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { AttachmentReferenceType, ClaimStatus } from '@/lib/db/types'
import { generateNanoId } from '@/lib/nanoid/client'
import { AppButton } from '@/components/app'
import { AttachmentUpload } from '@/components/attachments/attachment-upload'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Markdown } from '@/components/ui/markdown'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface SubmissionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  bountyId: string
  submissionId?: string // Required for edit mode
  onSuccess?: () => void
}

export function SubmissionModal({
  open,
  onOpenChange,
  mode,
  bountyId,
  submissionId,
  onSuccess,
}: SubmissionModalProps) {
  const { data: session } = useSession()
  const [draftDescription, setDraftDescription] = useState<string | null>(null)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Pre-generate ID for pending submissions (allows attachments before submit)
  const [pendingSubmissionId] = useState(() => generateNanoId())

  // Fetch bounty data for create mode (for acceptance criteria)
  const { data: bounty, isLoading: bountyLoading } =
    trpc.bounty.getById.useQuery(
      { id: bountyId },
      { enabled: mode === 'create' && !!bountyId && open },
    )

  // Fetch submission data for edit mode
  const { data: submission, isLoading: submissionLoading } =
    trpc.submission.getById.useQuery(
      { id: submissionId! },
      { enabled: mode === 'edit' && !!submissionId && open },
    )

  const baseDescription = mode === 'edit' ? (submission?.description ?? '') : ''
  const description = draftDescription ?? baseDescription

  const handleOpenChange = (nextOpen: boolean) => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }

    if (!nextOpen) {
      resetTimerRef.current = setTimeout(() => {
        setDraftDescription(null)
      }, 200)
    }

    onOpenChange(nextOpen)
  }

  const utils = trpc.useUtils()

  const createSubmission = trpc.submission.create.useMutation({
    onSuccess: () => {
      toast.success('Work submitted!')
      utils.bounty.getById.invalidate({ id: bountyId })
      handleOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const updateSubmission = trpc.submission.update.useMutation({
    onSuccess: () => {
      toast.success('Submission updated!')
      utils.submission.getById.invalidate({ id: submissionId })
      utils.bounty.getById.invalidate({ id: bountyId })
      handleOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const isDataLoading =
    (mode === 'create' && bountyLoading) ||
    (mode === 'edit' && submissionLoading)

  const isLoading = createSubmission.isPending || updateSubmission.isPending
  const isValid = description.trim().length > 0
  const hasChanges =
    mode === 'edit'
      ? draftDescription !== null &&
        description !== (submission?.description ?? '')
      : true

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || (mode === 'edit' && !hasChanges)) return

    if (mode === 'create') {
      await createSubmission.mutateAsync({
        id: pendingSubmissionId,
        bountyId,
        description,
      })
    } else {
      await updateSubmission.mutateAsync({
        id: submissionId!,
        description,
      })
    }
  }

  // Verify user has an active claim (for create mode)
  const userClaim =
    mode === 'create' && bounty
      ? bounty.claims.find(
          (c) =>
            c.userId === session?.user?.id && c.status === ClaimStatus.ACTIVE,
        )
      : null

  const canSubmit = mode === 'create' ? !!userClaim : true

  const pageTitle = mode === 'create' ? 'Submit Work' : 'Edit Submission'
  const submitLabel = mode === 'create' ? 'Submit Work' : 'Save Changes'
  const evidenceDescription =
    mode === 'create'
      ? bounty?.evidenceDescription
      : submission?.bounty?.evidenceDescription

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-4xl min-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{pageTitle}</DialogTitle>
        </DialogHeader>

        {isDataLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </div>
        ) : !canSubmit && mode === 'create' ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              You need an active claim on this bounty to submit work.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
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

              {/* Description editor */}
              <div className="rounded-lg border border-border bg-accent">
                <div className="px-4 py-3">
                  <label className="mb-2 block text-sm font-medium">
                    Description
                  </label>
                  <MarkdownEditor
                    value={description}
                    onChange={(value) => setDraftDescription(value)}
                    placeholder="Describe what you did, how it meets the requirements, and include any relevant links or notes..."
                    disabled={isLoading}
                    minHeight="240px"
                    contentClassName="text-sm"
                  />
                </div>
              </div>

              {/* Attachments */}
              <div className="rounded-lg border border-border bg-accent">
                <div className="px-4 py-3">
                  <label className="mb-2 block text-sm font-medium">
                    Attachments
                  </label>
                  {mode === 'edit' ? (
                    // Edit mode: show existing attachments + upload
                    <AttachmentUpload
                      referenceType={AttachmentReferenceType.SUBMISSION}
                      referenceId={submissionId!}
                      bountyId={bountyId}
                      disabled={isLoading}
                    />
                  ) : (
                    // Create mode: show pending attachments + upload
                    <AttachmentUpload
                      referenceType={AttachmentReferenceType.PENDING_SUBMISSION}
                      referenceId={pendingSubmissionId}
                      bountyId={bountyId}
                      disabled={isLoading}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <AppButton
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </AppButton>
              <AppButton
                type="submit"
                disabled={
                  isLoading || !isValid || (mode === 'edit' && !hasChanges)
                }
              >
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {submitLabel}
              </AppButton>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
