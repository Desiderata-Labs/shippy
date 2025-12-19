'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { Lightbulb01 } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { redirect } from 'next/navigation'
import { AttachmentReferenceType } from '@/lib/db/types'
import { generateNanoId } from '@/lib/nanoid/client'
import { ProjectTab, routes } from '@/lib/routes'
import { UploadFolder } from '@/lib/uploads/folders'
import { AppButton } from '@/components/app'
import { AttachmentUpload } from '@/components/attachments/attachment-upload'
import { AppBackground } from '@/components/layout/app-background'
import { ErrorState } from '@/components/ui/error-state'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { NotFoundState } from '@/components/ui/not-found-state'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface SuggestionEditorProps {
  slug: string
}

export function SuggestionEditor({ slug }: SuggestionEditorProps) {
  const router = useRouter()
  const { data: session, isPending: sessionLoading } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [evidenceDescription, setEvidenceDescription] = useState('')

  // Generate a stable ID for pending attachments
  const entityId = useMemo(() => generateNanoId(), [])

  // Fetch project data
  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
    error: projectErrorData,
    refetch: refetchProject,
  } = trpc.project.getBySlug.useQuery(
    { slug },
    { enabled: !!slug, retry: false },
  )

  const suggestBounty = trpc.bounty.suggest.useMutation({
    onSuccess: (newBounty) => {
      toast.success('Suggestion submitted! The founder will review it.')
      router.push(
        routes.project.bountyDetail({
          slug,
          bountyId: newBounty.id,
          title,
        }),
      )
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Loading state
  const isDataLoading = sessionLoading || projectLoading

  if (isDataLoading) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-3xl p-6">
          <div className="mb-6">
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="mb-6 h-8 w-48" />
          <Skeleton className="h-96" />
        </div>
      </AppBackground>
    )
  }

  // Auth check
  if (!session) {
    redirect(routes.auth.signIn())
  }

  // Handle project errors
  if (projectError) {
    const isNotFoundOrForbidden =
      projectErrorData?.data?.code === 'NOT_FOUND' ||
      projectErrorData?.data?.code === 'FORBIDDEN' ||
      projectErrorData?.data?.code === 'BAD_REQUEST'
    return (
      <AppBackground>
        <div className="mx-auto max-w-3xl p-6">
          {isNotFoundOrForbidden ? (
            <NotFoundState
              resourceType="project"
              backHref={routes.dashboard.root()}
              backLabel="Back to Dashboard"
            />
          ) : (
            <ErrorState
              message={projectErrorData?.message}
              errorId={projectErrorData?.data?.errorId}
              backHref={routes.dashboard.root()}
              backLabel="Back to Dashboard"
              onRetry={() => refetchProject()}
            />
          )}
        </div>
      </AppBackground>
    )
  }

  // Project not found
  if (!project) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-3xl p-6">
          <NotFoundState
            resourceType="project"
            backHref={routes.dashboard.root()}
            backLabel="Back to Dashboard"
          />
        </div>
      </AppBackground>
    )
  }

  // Founder should use the create page, not suggest
  if (project.founderId === session.user.id) {
    router.replace(routes.project.newBounty({ slug }))
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setIsLoading(true)
    try {
      await suggestBounty.mutateAsync({
        id: entityId,
        projectId: project.id,
        title,
        description,
        evidenceDescription: evidenceDescription || undefined,
      })
    } catch {
      // Error is handled by onError callback
    } finally {
      setIsLoading(false)
    }
  }

  const isValid = title.trim() && description.trim()

  return (
    <AppBackground>
      <div className="mx-auto max-w-3xl p-6">
        {/* Breadcrumb navigation */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link
            href={routes.project.detail({ slug })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {project.name}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <Link
            href={routes.project.detail({
              slug,
              tab: ProjectTab.BOUNTIES,
            })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Bounties
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground">Suggest</span>
        </div>

        {/* Header with icon */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-purple-500/10">
            <Lightbulb01 className="size-5 text-purple-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Suggest a Bounty</h1>
            <p className="text-sm text-muted-foreground">
              Have an idea for a bounty? Suggest it and the founder will review.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Main input area */}
          <div className="rounded-lg border border-border bg-accent">
            {/* Title input */}
            <div className="px-4 py-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Bounty title"
                required
                disabled={isLoading}
                className="w-full bg-transparent text-xl font-semibold placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>

            <Separator />

            {/* Description input - markdown editor */}
            <div className="px-4 py-3">
              <MarkdownEditor
                value={description}
                onChange={setDescription}
                placeholder="Describe the bounty... What needs to be done? Why is it valuable?"
                disabled={isLoading}
                minHeight="120px"
                contentClassName="text-sm"
                enableUploads
                uploadFolder={UploadFolder.BOUNTIES}
                uploadConfig={{
                  referenceType: AttachmentReferenceType.PENDING_BOUNTY,
                  referenceId: entityId,
                  projectId: project.id,
                }}
              />
            </div>

            <Separator />

            {/* Acceptance Criteria - markdown editor */}
            <div className="px-4 py-3">
              <MarkdownEditor
                value={evidenceDescription}
                onChange={setEvidenceDescription}
                placeholder="Suggested acceptance criteria (optional)... What proof should be provided?"
                disabled={isLoading}
                minHeight="80px"
                contentClassName="text-sm"
                enableUploads
                uploadFolder={UploadFolder.BOUNTIES}
                uploadConfig={{
                  referenceType: AttachmentReferenceType.PENDING_BOUNTY,
                  referenceId: entityId,
                  projectId: project.id,
                }}
              />
            </div>

            <Separator />

            {/* Attachments */}
            <div className="space-y-2 px-4 py-3">
              <span className="text-xs text-muted-foreground">Attachments</span>
              <AttachmentUpload
                referenceType={AttachmentReferenceType.PENDING_BOUNTY}
                referenceId={entityId}
                projectId={project.id}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Info callout */}
          <div className="mt-4 rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">What happens next?</strong>{' '}
              The founder will receive a notification and can approve your
              suggestion (optionally adding points and labels), or close it with
              feedback.
            </p>
          </div>

          {/* Submit button */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <AppButton
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </AppButton>
            <AppButton type="submit" disabled={isLoading || !isValid}>
              {isLoading && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              Submit Suggestion
            </AppButton>
          </div>
        </form>
      </div>
    </AppBackground>
  )
}
