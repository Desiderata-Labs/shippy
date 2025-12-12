'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  AlertCircle,
  Check,
  CheckCircle,
  Circle,
  Clock,
  DotsVertical,
  Edit02,
  FileCheck03,
  Link03,
  Pencil01,
  Target01,
  Trash01,
  User01,
  Users01,
  XCircle,
} from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { notFound } from 'next/navigation'
import { getTagColor } from '@/lib/bounty/tag-colors'
import {
  BountyClaimMode,
  BountyEventType,
  BountyStatus,
  ClaimStatus,
  SubmissionStatus,
} from '@/lib/db/types'
import { ProjectTab, routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { AppButton } from '@/components/app'
import { EditBountyModal } from '@/components/bounty/edit-bounty-modal'
import { SubmitWorkModal } from '@/components/bounty/submit-work-modal'
import { CommentInput } from '@/components/comments'
import { AppBackground } from '@/components/layout/app-background'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Markdown } from '@/components/ui/markdown'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'

export default function BountyDetailPage() {
  const router = useRouter()
  const params = useParams<{ slug: string; bountyId: string }>()
  const { data: session } = useSession()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [releaseReason, setReleaseReason] = useState('')
  const [newComment, setNewComment] = useState('')
  const [isPostingComment, setIsPostingComment] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<string | null>(null)

  const { data: bounty, isLoading } = trpc.bounty.getById.useQuery(
    { id: params.bountyId },
    { enabled: !!params.bountyId },
  )

  const utils = trpc.useUtils()

  const claimBounty = trpc.bounty.claim.useMutation({
    onSuccess: () => {
      toast.success('Bounty claimed! You can now start working on it.')
      utils.bounty.getById.invalidate({ id: params.bountyId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const releaseClaim = trpc.bounty.releaseClaim.useMutation({
    onSuccess: () => {
      toast.success('Claim released')
      utils.bounty.getById.invalidate({ id: params.bountyId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const createSubmission = trpc.submission.create.useMutation({
    onSuccess: (submission) => {
      toast.success('Work submitted!')
      setShowSubmitModal(false)
      router.push(
        routes.project.submissionDetail({
          slug: params.slug,
          submissionId: submission.id,
        }),
      )
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const addComment = trpc.bounty.addComment.useMutation({
    onSuccess: () => {
      setNewComment('')
      utils.bounty.getById.invalidate({ id: params.bountyId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deleteComment = trpc.bounty.deleteComment.useMutation({
    onSuccess: () => {
      utils.bounty.getById.invalidate({ id: params.bountyId })
      toast.success('Comment deleted')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  if (isLoading) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-6 flex items-center gap-3">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="mb-4 h-8 w-3/4" />
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <Skeleton className="h-64" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </AppBackground>
    )
  }

  if (!bounty) {
    notFound()
  }

  const userClaim = bounty.claims.find((c) => c.userId === session?.user?.id)
  const hasActiveClaim = userClaim?.status === ClaimStatus.ACTIVE
  const hasSubmittedClaim = userClaim?.status === ClaimStatus.SUBMITTED
  const isFounder = session?.user?.id === bounty.project.founderId
  const canClaim =
    session &&
    bounty.status === BountyStatus.OPEN &&
    !userClaim &&
    (bounty.claimMode === BountyClaimMode.MULTIPLE ||
      bounty.claims.length === 0)

  const handleClaim = async () => {
    setIsSubmitting(true)
    try {
      await claimBounty.mutateAsync({ bountyId: bounty.id })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReleaseClaim = async () => {
    if (!userClaim) return
    setIsSubmitting(true)
    try {
      await releaseClaim.mutateAsync({
        claimId: userClaim.id,
        reason: releaseReason.trim() || undefined,
      })
      setShowReleaseModal(false)
      setReleaseReason('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitWork = async (description: string) => {
    setIsSubmitting(true)
    try {
      await createSubmission.mutateAsync({
        bountyId: bounty.id,
        description,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePostComment = async () => {
    if (!newComment.trim()) return
    setIsPostingComment(true)
    try {
      await addComment.mutateAsync({
        bountyId: bounty.id,
        content: newComment,
      })
    } finally {
      setIsPostingComment(false)
    }
  }

  const commitmentDate = bounty.project.rewardPool?.commitmentEndsAt
  const commitmentRemaining = commitmentDate
    ? Math.ceil(
        (new Date(commitmentDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null

  const bountyDisplayId = `${bounty.project.projectKey}-${bounty.number}`

  const bountyUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/p/${params.slug}/bounty/${params.bountyId}`
      : ''

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(bountyUrl)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  // Status icon helper
  const StatusIcon = ({ size = 'md' }: { size?: 'sm' | 'md' }) => {
    const sizeClass = size === 'sm' ? 'size-4' : 'size-5'
    if (bounty.status === BountyStatus.COMPLETED) {
      return <CheckCircle className={`${sizeClass} text-blue-500`} />
    }
    if (bounty.status === BountyStatus.CLOSED) {
      return <XCircle className={`${sizeClass} text-muted-foreground/50`} />
    }
    if (bounty.status === BountyStatus.CLAIMED) {
      return <Clock className={`${sizeClass} text-yellow-500`} />
    }
    return <Circle className={`${sizeClass} text-muted-foreground`} />
  }

  const statusLabel =
    bounty.status === BountyStatus.COMPLETED
      ? 'Done'
      : bounty.status === BountyStatus.CLOSED
        ? 'Closed'
        : bounty.status === BountyStatus.CLAIMED
          ? 'In Progress'
          : 'Open'

  // Show approved submission's user as assignee if completed, otherwise first claimant
  const approvedSubmission = bounty.submissions.find(
    (s) => s.status === SubmissionStatus.APPROVED,
  )
  const assignee = approvedSubmission?.user ?? bounty.claims[0]?.user ?? null

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Breadcrumb navigation */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link
            href={routes.project.detail({
              slug: params.slug,
              tab: ProjectTab.BOUNTIES,
            })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {bounty.project.name}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <Link
            href={routes.project.detail({
              slug: params.slug,
              tab: ProjectTab.BOUNTIES,
            })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Bounties
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-mono text-foreground">{bountyDisplayId}</span>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {bounty.title}
          </h1>
          {isFounder && (
            <AppButton
              variant="outline"
              size="sm"
              onClick={() => setShowEditModal(true)}
              className="shrink-0"
            >
              <Pencil01 className="mr-1.5 size-3.5" />
              Edit
            </AppButton>
          )}
        </div>

        {/* Main layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_auto_280px]">
          {/* Main content */}
          <div className="space-y-6">
            {/* Description */}
            <Markdown markdown={bounty.description} proseSize="sm" />

            {/* Acceptance Criteria */}
            {bounty.evidenceDescription && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex gap-3">
                  <FileCheck03 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Acceptance Criteria</p>
                    <Markdown
                      markdown={bounty.evidenceDescription}
                      proseSize="sm"
                      className="mt-1 text-muted-foreground"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Activity timeline (events + submissions interleaved) */}
            <div className="space-y-4">
              {(() => {
                // Create unified timeline of events and submissions
                type TimelineItem =
                  | { type: 'event'; data: (typeof bounty.events)[0] }
                  | { type: 'submission'; data: (typeof bounty.submissions)[0] }

                const timeline: TimelineItem[] = [
                  ...bounty.events.map((e) => ({
                    type: 'event' as const,
                    data: e,
                  })),
                  ...bounty.submissions.map((s) => ({
                    type: 'submission' as const,
                    data: s,
                  })),
                ].sort(
                  (a, b) =>
                    new Date(a.data.createdAt).getTime() -
                    new Date(b.data.createdAt).getTime(),
                )

                const submissionStatusConfig: Record<
                  string,
                  { label: string; color: string }
                > = {
                  [SubmissionStatus.DRAFT]: {
                    label: 'draft',
                    color: 'text-muted-foreground',
                  },
                  [SubmissionStatus.PENDING]: {
                    label: 'pending review',
                    color: 'text-yellow-500',
                  },
                  [SubmissionStatus.NEEDS_INFO]: {
                    label: 'needs info',
                    color: 'text-orange-500',
                  },
                  [SubmissionStatus.APPROVED]: {
                    label: 'approved',
                    color: 'text-green-500',
                  },
                  [SubmissionStatus.REJECTED]: {
                    label: 'rejected',
                    color: 'text-red-500',
                  },
                  [SubmissionStatus.WITHDRAWN]: {
                    label: 'withdrawn',
                    color: 'text-muted-foreground',
                  },
                }

                // Helper to format edit changes (changes is already an object from JSONB)
                const formatEditChanges = (
                  changes: Record<
                    string,
                    { from: unknown; to: unknown }
                  > | null,
                ) => {
                  if (!changes) return null
                  const fieldNames: Record<string, string> = {
                    title: 'title',
                    description: 'description',
                    points: 'points',
                    tags: 'labels',
                    evidenceDescription: 'acceptance criteria',
                  }
                  return Object.keys(changes)
                    .map((field) => fieldNames[field] || field)
                    .join(', ')
                }

                return timeline.map((item) => {
                  if (item.type === 'submission') {
                    const submission = item.data
                    const status =
                      submissionStatusConfig[submission.status] ??
                      submissionStatusConfig[SubmissionStatus.PENDING]

                    return (
                      <div key={`sub-${submission.id}`} className="text-sm">
                        <div className="flex items-start gap-2">
                          <Check className="mt-0.5 size-4 text-primary" />
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span className="font-medium">
                              {submission.user.name}
                            </span>
                            <Link
                              href={routes.project.submissionDetail({
                                slug: params.slug,
                                submissionId: submission.id,
                              })}
                              className="text-muted-foreground hover:text-foreground hover:underline"
                            >
                              submitted work
                            </Link>
                            <span className={cn('text-xs', status.color)}>
                              ({status.label})
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(
                                submission.createdAt,
                              ).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  const event = item.data

                  // Edit event
                  if (event.type === BountyEventType.EDIT) {
                    const changedFields = formatEditChanges(
                      event.changes as Record<
                        string,
                        { from: unknown; to: unknown }
                      > | null,
                    )
                    return (
                      <div key={`evt-${event.id}`} className="text-sm">
                        <div className="flex items-start gap-2">
                          <Pencil01 className="mt-0.5 size-4 text-muted-foreground" />
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span className="font-medium">
                              {event.user.name}
                            </span>
                            <span className="text-muted-foreground">
                              edited{changedFields ? ` ${changedFields}` : ''}
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.createdAt).toLocaleDateString(
                                'en-US',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                },
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // Status change event
                  if (event.type === BountyEventType.STATUS_CHANGE) {
                    const statusLabels: Record<string, string> = {
                      [BountyStatus.OPEN]: 'Open',
                      [BountyStatus.CLAIMED]: 'In Progress',
                      [BountyStatus.COMPLETED]: 'Completed',
                      [BountyStatus.CLOSED]: 'Closed',
                    }
                    return (
                      <div key={`evt-${event.id}`} className="text-sm">
                        <div className="flex items-start gap-2">
                          <Edit02 className="mt-0.5 size-4 text-muted-foreground" />
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span className="font-medium">
                              {event.user.name}
                            </span>
                            <span className="text-muted-foreground">
                              changed status from{' '}
                              {statusLabels[event.fromStatus ?? ''] ||
                                event.fromStatus}{' '}
                              to{' '}
                              {statusLabels[event.toStatus ?? ''] ||
                                event.toStatus}
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.createdAt).toLocaleDateString(
                                'en-US',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                },
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // Comment event
                  return (
                    <div key={`evt-${event.id}`} className="group flex gap-3">
                      <Avatar className="size-7 shrink-0">
                        <AvatarImage src={event.user.image ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {event.user.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {event.user.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.createdAt).toLocaleDateString(
                              'en-US',
                              {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              },
                            )}
                          </span>
                        </div>
                        <Markdown
                          markdown={event.content ?? ''}
                          proseSize="sm"
                          className="mt-1"
                        />
                      </div>
                      {(event.userId === session?.user?.id || isFounder) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-6 cursor-pointer text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <DotsVertical className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setEventToDelete(event.id)}
                              className="cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash01 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  )
                })
              })()}

              {/* Comment input */}
              {session ? (
                <CommentInput
                  value={newComment}
                  onChange={setNewComment}
                  onSubmit={handlePostComment}
                  isLoading={isPostingComment}
                />
              ) : (
                <div className="rounded-lg border border-border px-4 py-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    <Link
                      href={routes.auth.signIn()}
                      className="text-primary hover:underline"
                    >
                      Sign in
                    </Link>{' '}
                    to leave a comment
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Vertical separator */}
          <Separator orientation="vertical" className="hidden lg:block" />

          {/* Sidebar - Linear style properties panel */}
          <div className="space-y-4">
            {/* Properties header */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Properties</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="cursor-pointer rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Link03
                      className={cn('size-4', copied && 'text-green-500')}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {copied ? 'Copied!' : 'Copy link'}
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Actions */}
            {/* Actions */}
            {!session ? (
              <AppButton asChild className="w-full" size="sm">
                <Link href={routes.auth.signIn()}>Sign In to Claim</Link>
              </AppButton>
            ) : hasActiveClaim ? (
              <div className="space-y-2">
                <AppButton
                  onClick={() => setShowSubmitModal(true)}
                  className="w-full"
                  size="sm"
                >
                  <Check className="mr-1.5 size-3.5" />
                  Submit Work
                </AppButton>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReleaseModal(true)}
                  className="w-full cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  Release Claim
                </Button>
              </div>
            ) : hasSubmittedClaim ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReleaseModal(true)}
                className="w-full cursor-pointer text-muted-foreground hover:text-foreground"
              >
                Release Claim
              </Button>
            ) : canClaim ? (
              <AppButton
                onClick={handleClaim}
                disabled={isSubmitting}
                className="w-full"
                size="sm"
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                <Target01 className="mr-1.5 size-3.5" />
                Claim Bounty
              </AppButton>
            ) : null}

            <Separator />

            {/* Properties details */}
            <div className="space-y-3">
              {/* Status */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Status</span>
                <div className="flex items-center gap-1.5">
                  <StatusIcon size="sm" />
                  <span className="text-xs">{statusLabel}</span>
                </div>
              </div>

              {/* Points */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Points</span>
                <span className="rounded-sm bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  +{bounty.points}
                </span>
              </div>

              {/* Assignee */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Assignee</span>
                {assignee ? (
                  <div className="flex items-center gap-1.5">
                    <Avatar className="size-5">
                      <AvatarImage src={assignee.image ?? undefined} />
                      <AvatarFallback className="text-[9px]">
                        {assignee.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{assignee.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <div className="flex size-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/30">
                      <User01 className="size-2.5" />
                    </div>
                    <span className="text-xs">Unassigned</span>
                  </div>
                )}
              </div>

              {/* Labels (tags) */}
              {bounty.tags.length > 0 && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-muted-foreground">Labels</span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {bounty.tags.map((tag) => {
                      const color = getTagColor(tag)
                      return (
                        <span
                          key={tag}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize',
                            color.border,
                            color.text,
                          )}
                        >
                          <span
                            className={cn('size-1.5 rounded-full', color.dot)}
                          />
                          {tag.toLowerCase()}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Claim mode */}
              <div className="flex items-center justify-between py-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex cursor-help items-center gap-1 text-xs text-muted-foreground">
                      <Users01 className="size-3" />
                      Claim Type
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {bounty.claimMode === BountyClaimMode.SINGLE
                      ? 'Only one person can work on this bounty at a time.'
                      : 'Multiple people can work on this bounty simultaneously.'}
                  </TooltipContent>
                </Tooltip>
                <span className="text-xs">
                  {bounty.claimMode === BountyClaimMode.SINGLE
                    ? 'Single'
                    : 'Multiple'}
                </span>
              </div>

              {/* Claim expiry */}
              <div className="flex items-center justify-between py-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex cursor-help items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      Claim Expires
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Once you claim this bounty, you have this many days to
                    complete and submit your work.
                  </TooltipContent>
                </Tooltip>
                <span className="text-xs">
                  {bounty.claimExpiryDays} day
                  {bounty.claimExpiryDays !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Pool ends */}
              {commitmentDate && (
                <div className="flex items-center justify-between py-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex cursor-help items-center gap-1 text-xs text-muted-foreground">
                        <Target01 className="size-3" />
                        Pool Ends
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      The founder has committed to paying contributors until
                      this date.
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-xs">
                    {new Date(commitmentDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Pool warning */}
            {bounty.project.rewardPool &&
              commitmentRemaining !== null &&
              commitmentRemaining < 90 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                  <div className="flex gap-2">
                    <AlertCircle className="size-4 shrink-0 text-amber-500" />
                    <div className="text-xs text-amber-700 dark:text-amber-400">
                      <p className="font-medium">Pool commitment ending soon</p>
                      <p className="mt-0.5 opacity-80">
                        Ends in {commitmentRemaining} days
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Submit work modal */}
      <SubmitWorkModal
        open={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onSubmit={handleSubmitWork}
        evidenceDescription={bounty.evidenceDescription}
        isLoading={isSubmitting}
      />

      {/* Release claim modal */}
      <ConfirmModal
        open={showReleaseModal}
        onClose={() => {
          setShowReleaseModal(false)
          setReleaseReason('')
        }}
        onConfirm={handleReleaseClaim}
        title="Release this claim?"
        description={
          hasSubmittedClaim
            ? 'This will free up the bounty for others to claim. Your submission will be marked as withdrawn and will no longer be reviewed.'
            : "This will free up the bounty for others to claim. Any work you've done won't be lost, but you'll need to claim it again to submit."
        }
        content={
          <textarea
            value={releaseReason}
            onChange={(e) => setReleaseReason(e.target.value)}
            placeholder="Reason for releasing (optional)"
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
            rows={3}
          />
        }
        confirmText="Release Claim"
        cancelText="Keep Claim"
        variant="destructive"
        isLoading={isSubmitting}
      />

      {/* Delete comment modal */}
      <ConfirmModal
        open={!!eventToDelete}
        onClose={() => setEventToDelete(null)}
        onConfirm={() => {
          if (eventToDelete) {
            deleteComment.mutate(
              { eventId: eventToDelete },
              { onSuccess: () => setEventToDelete(null) },
            )
          }
        }}
        title="Delete comment?"
        description="This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteComment.isPending}
      />

      {/* Edit bounty modal */}
      <EditBountyModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        bounty={bounty}
      />
    </AppBackground>
  )
}
