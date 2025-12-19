'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { FileCheck03 } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { redirect } from 'next/navigation'
import { AttachmentReferenceType, ClaimStatus } from '@/lib/db/types'
import { generateNanoId } from '@/lib/nanoid/client'
import { routes } from '@/lib/routes'
import { AppButton } from '@/components/app'
import { AttachmentUpload } from '@/components/attachments/attachment-upload'
import { AppBackground } from '@/components/layout/app-background'
import { ErrorState } from '@/components/ui/error-state'
import { Markdown } from '@/components/ui/markdown'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { NotFoundState } from '@/components/ui/not-found-state'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface SubmissionEditorProps {
  mode: 'create' | 'edit'
  slug: string
  bountyId?: string // Required for create mode
  submissionId?: string // Required for edit mode
}

export function SubmissionEditor({
  mode,
  slug,
  bountyId,
  submissionId,
}: SubmissionEditorProps) {
  const router = useRouter()
  const { data: session, isPending: sessionLoading } = useSession()
  const [description, setDescription] = useState('')
  // Track previous submission to detect when we need to reinitialize
  const [prevSubmissionId, setPrevSubmissionId] = useState<string | null>(null)

  // Generate a stable ID for new submissions (used for pending attachments)
  // In edit mode, use the existing submissionId
  const entityId = useMemo(
    () => (mode === 'create' ? generateNanoId() : submissionId!),
    [mode, submissionId],
  )

  // Fetch bounty data for create mode (for acceptance criteria)
  const {
    data: bounty,
    isLoading: bountyLoading,
    isError: bountyError,
    error: bountyErrorData,
    refetch: refetchBounty,
  } = trpc.bounty.getById.useQuery(
    { id: bountyId! },
    { enabled: mode === 'create' && !!bountyId, retry: false },
  )

  // Fetch submission data for edit mode
  const {
    data: submission,
    isLoading: submissionLoading,
    isError: submissionError,
    error: submissionErrorData,
    refetch: refetchSubmission,
  } = trpc.submission.getById.useQuery(
    { id: submissionId! },
    { enabled: mode === 'edit' && !!submissionId, retry: false },
  )

  // Initialize form with existing submission data in edit mode
  // Using React's recommended pattern for adjusting state based on props during render
  if (mode === 'edit' && submission && submission.id !== prevSubmissionId) {
    setDescription(submission.description)
    setPrevSubmissionId(submission.id)
  }

  const utils = trpc.useUtils()

  const createSubmission = trpc.submission.create.useMutation({
    onSuccess: (newSubmission) => {
      toast.success('Work submitted!')
      router.push(
        routes.project.submissionDetail({
          slug,
          bountyId: bountyId!,
          submissionId: newSubmission.id,
          title: bounty?.title,
        }),
      )
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const updateSubmission = trpc.submission.update.useMutation({
    onSuccess: () => {
      toast.success('Submission updated!')
      utils.submission.getById.invalidate({ id: submissionId })
      router.push(
        routes.project.submissionDetail({
          slug,
          bountyId: submission?.bountyId ?? '',
          submissionId: submissionId!,
          title: submission?.bounty?.title,
        }),
      )
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const isDataLoading =
    sessionLoading ||
    (mode === 'create' && bountyLoading) ||
    (mode === 'edit' && submissionLoading) ||
    (mode === 'edit' && !prevSubmissionId)

  if (isDataLoading) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="mb-6">
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="mb-4 h-8 w-64" />
          <Skeleton className="h-96" />
        </div>
      </AppBackground>
    )
  }

  // Auth check
  if (!session) {
    redirect(routes.auth.signIn())
  }

  const projectHref = routes.project.detail({ slug })

  // Mode-specific checks
  if (mode === 'create') {
    // Handle bounty errors
    if (bountyError) {
      const isNotFound =
        bountyErrorData?.data?.code === 'NOT_FOUND' ||
        bountyErrorData?.data?.code === 'BAD_REQUEST'
      return (
        <AppBackground>
          <div className="mx-auto max-w-4xl p-6">
            {isNotFound ? (
              <NotFoundState
                resourceType="bounty"
                backHref={projectHref}
                backLabel="Back to Project"
              />
            ) : (
              <ErrorState
                message={bountyErrorData?.message}
                errorId={bountyErrorData?.data?.errorId}
                backHref={projectHref}
                backLabel="Back to Project"
                onRetry={() => refetchBounty()}
              />
            )}
          </div>
        </AppBackground>
      )
    }
    if (!bounty) {
      return (
        <AppBackground>
          <div className="mx-auto max-w-4xl p-6">
            <NotFoundState
              resourceType="bounty"
              backHref={projectHref}
              backLabel="Back to Project"
            />
          </div>
        </AppBackground>
      )
    }
    // Check if user has an active claim on this bounty
    const userClaim = bounty.claims.find(
      (c) => c.userId === session.user.id && c.status === ClaimStatus.ACTIVE,
    )
    if (!userClaim) {
      // User doesn't have an active claim - redirect to bounty
      router.push(
        routes.project.bountyDetail({
          slug,
          bountyId: bountyId!,
          title: bounty?.title,
        }),
      )
      return null
    }
  } else {
    // Handle submission errors
    if (submissionError) {
      const isNotFound =
        submissionErrorData?.data?.code === 'NOT_FOUND' ||
        submissionErrorData?.data?.code === 'BAD_REQUEST'
      return (
        <AppBackground>
          <div className="mx-auto max-w-4xl p-6">
            {isNotFound ? (
              <NotFoundState
                resourceType="submission"
                backHref={projectHref}
                backLabel="Back to Project"
              />
            ) : (
              <ErrorState
                message={submissionErrorData?.message}
                errorId={submissionErrorData?.data?.errorId}
                backHref={projectHref}
                backLabel="Back to Project"
                onRetry={() => refetchSubmission()}
              />
            )}
          </div>
        </AppBackground>
      )
    }
    if (!submission || submission.userId !== session.user.id) {
      return (
        <AppBackground>
          <div className="mx-auto max-w-4xl p-6">
            <NotFoundState
              resourceType="submission"
              backHref={projectHref}
              backLabel="Back to Project"
            />
          </div>
        </AppBackground>
      )
    }
  }

  const isLoading = createSubmission.isPending || updateSubmission.isPending
  const isValid = description.trim().length > 0
  const hasChanges =
    mode === 'edit' ? description !== submission?.description : true

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || (mode === 'edit' && !hasChanges)) return

    if (mode === 'create') {
      await createSubmission.mutateAsync({
        id: entityId, // Pre-generated ID for attachment association
        bountyId: bountyId!,
        description,
      })
    } else {
      await updateSubmission.mutateAsync({
        id: submissionId!,
        description,
      })
    }
  }

  const pageTitle = mode === 'create' ? 'Submit Work' : 'Edit Submission'
  const submitLabel = mode === 'create' ? 'Submit Work' : 'Save Changes'
  const evidenceDescription =
    mode === 'create'
      ? bounty?.evidenceDescription
      : submission?.bounty?.evidenceDescription

  // Build breadcrumb
  const breadcrumb =
    mode === 'create'
      ? {
          projectName: bounty?.project?.name ?? '',
          bountyTitle: bounty?.title ?? '',
          bountyHref: routes.project.bountyDetail({
            slug,
            bountyId: bountyId!,
            title: bounty?.title,
          }),
        }
      : {
          projectName: submission?.bounty?.project?.name ?? '',
          bountyTitle: submission?.bounty?.title ?? '',
          bountyHref: routes.project.bountyDetail({
            slug,
            bountyId: submission?.bountyId ?? '',
            title: submission?.bounty?.title,
          }),
          submissionHref: routes.project.submissionDetail({
            slug,
            bountyId: submission?.bountyId ?? '',
            submissionId: submissionId!,
            title: submission?.bounty?.title,
          }),
        }

  return (
    <AppBackground>
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Breadcrumb navigation */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link
            href={routes.project.detail({ slug })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {breadcrumb.projectName}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <Link
            href={breadcrumb.bountyHref}
            className="max-w-[200px] truncate text-muted-foreground transition-colors hover:text-foreground"
          >
            {breadcrumb.bountyTitle}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          {mode === 'edit' && breadcrumb.submissionHref && (
            <>
              <Link
                href={breadcrumb.submissionHref}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Submission
              </Link>
              <span className="text-muted-foreground/50">/</span>
            </>
          )}
          <span className="text-foreground">{pageTitle}</span>
        </div>

        <h1 className="mb-6 text-xl font-semibold tracking-tight sm:text-2xl">
          {pageTitle}
        </h1>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Acceptance Criteria (only show for create mode) */}
            {mode === 'create' && evidenceDescription && (
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
                  onChange={setDescription}
                  placeholder="Describe what you did, how it meets the requirements, and include any relevant links or notes..."
                  disabled={isLoading}
                  minHeight="280px"
                  contentClassName="text-sm"
                />
              </div>

              {/* Attachments */}
              <Separator />
              <div className="space-y-2 px-4 py-3">
                <label className="block text-sm font-medium">Attachments</label>
                <AttachmentUpload
                  referenceType={
                    mode === 'create'
                      ? AttachmentReferenceType.PENDING_SUBMISSION
                      : AttachmentReferenceType.SUBMISSION
                  }
                  referenceId={entityId}
                  bountyId={bountyId ?? submission?.bountyId}
                  disabled={isLoading}
                />
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <AppButton
                type="button"
                variant="outline"
                onClick={() => router.back()}
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
          </div>
        </form>
      </div>
    </AppBackground>
  )
}
