'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  Check,
  CheckCircle,
  ChevronDown,
  Clock,
  DotsVertical,
  Edit02,
  Link03,
  MessageTextSquare02,
  Pencil01,
  XCircle,
} from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { SubmissionEventType, SubmissionStatus } from '@/lib/db/types'
import { formatRelativeTime } from '@/lib/format/relative-time'
import { extractNanoIdFromSlug } from '@/lib/nanoid/shared'
import { routes } from '@/lib/routes'
import {
  submissionStatusColors,
  submissionStatusLabels,
} from '@/lib/status-colors'
import { cn } from '@/lib/utils'
import { AppButton, AppTextarea } from '@/components/app'
import { CommentInput } from '@/components/comments'
import { AppBackground } from '@/components/layout/app-background'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ErrorState } from '@/components/ui/error-state'
import { Markdown } from '@/components/ui/markdown'
import { NotFoundState } from '@/components/ui/not-found-state'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'

const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof Check }
> = {
  [SubmissionStatus.DRAFT]: {
    label: submissionStatusLabels.DRAFT,
    color: submissionStatusColors.DRAFT.text,
    icon: Clock,
  },
  [SubmissionStatus.PENDING]: {
    label: submissionStatusLabels.PENDING,
    color: submissionStatusColors.PENDING.text,
    icon: Clock,
  },
  [SubmissionStatus.NEEDS_INFO]: {
    label: submissionStatusLabels.NEEDS_INFO,
    color: submissionStatusColors.NEEDS_INFO.text,
    icon: MessageTextSquare02,
  },
  [SubmissionStatus.APPROVED]: {
    label: submissionStatusLabels.APPROVED,
    color: submissionStatusColors.APPROVED.text,
    icon: CheckCircle,
  },
  [SubmissionStatus.REJECTED]: {
    label: submissionStatusLabels.REJECTED,
    color: submissionStatusColors.REJECTED.text,
    icon: XCircle,
  },
  [SubmissionStatus.WITHDRAWN]: {
    label: submissionStatusLabels.WITHDRAWN,
    color: submissionStatusColors.WITHDRAWN.text,
    icon: XCircle,
  },
}

type ReviewAction = 'comment' | 'approve' | 'requestInfo' | 'reject'

export function SubmissionDetailContent() {
  const params = useParams<{ slug: string; submissionId: string }>()
  // Extract the nanoid from the URL slug (e.g., "bounty-title-TdFKukO9LuJe" -> "TdFKukO9LuJe")
  const submissionId = extractNanoIdFromSlug(params.submissionId)
  const { data: session } = useSession()
  const [messageContent, setMessageContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewAction, setReviewAction] = useState<ReviewAction>('comment')
  const [showReviewPopover, setShowReviewPopover] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isUpdatingComment, setIsUpdatingComment] = useState(false)

  const {
    data: submission,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.submission.getById.useQuery(
    { id: submissionId },
    { enabled: !!submissionId, retry: false },
  )

  // Fetch pool stats to check if approval would expand the pool
  const { data: poolStats } = trpc.project.getPoolStats.useQuery(
    { projectId: submission?.bounty.project.id ?? '' },
    { enabled: !!submission?.bounty.project.id },
  )

  const utils = trpc.useUtils()

  const addComment = trpc.submission.addComment.useMutation({
    onSuccess: () => {
      setMessageContent('')
      utils.submission.getById.invalidate({ id: submissionId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const updateComment = trpc.submission.updateComment.useMutation({
    onSuccess: () => {
      utils.submission.getById.invalidate({ id: submissionId })
      toast.success('Comment updated')
      setEditingEventId(null)
      setEditContent('')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const reviewSubmission = trpc.submission.review.useMutation({
    onSuccess: () => {
      toast.success('Review submitted')
      setShowReviewPopover(false)
      setReviewNote('')
      setReviewAction('comment')
      utils.submission.getById.invalidate({ id: submissionId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  if (isLoading) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          <div className="mb-6 flex items-center gap-3">
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="mb-4 h-8 w-3/4" />
          <div className="grid gap-6 lg:grid-cols-[1fr_auto_280px]">
            <Skeleton className="h-64" />
            <Skeleton className="hidden h-full w-px lg:block" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </AppBackground>
    )
  }

  // Handle errors - differentiate between 404 and other errors
  // BAD_REQUEST with invalid NanoID is also effectively a 404
  if (isError) {
    const isNotFound =
      error?.data?.code === 'NOT_FOUND' || error?.data?.code === 'BAD_REQUEST'
    const projectHref = routes.project.detail({ slug: params.slug })
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          {isNotFound ? (
            <NotFoundState
              resourceType="submission"
              backHref={projectHref}
              backLabel="Back to Project"
            />
          ) : (
            <ErrorState
              message={error?.message}
              errorId={error?.data?.errorId}
              backHref={projectHref}
              backLabel="Back to Project"
              onRetry={() => refetch()}
            />
          )}
        </div>
      </AppBackground>
    )
  }

  if (!submission) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          <NotFoundState
            resourceType="submission"
            backHref={routes.project.detail({ slug: params.slug })}
            backLabel="Back to Project"
          />
        </div>
      </AppBackground>
    )
  }

  const isFounder = session?.user?.id === submission.bounty.project.founderId
  const isSubmitter = session?.user?.id === submission.userId
  // Terminal states where no further action is possible
  const isFullyTerminalStatus = [
    SubmissionStatus.APPROVED,
    SubmissionStatus.WITHDRAWN,
  ].includes(submission.status as SubmissionStatus)
  // Founder can review rejected submissions to retroactively approve
  const canReview = isFounder && !isFullyTerminalStatus
  // Submitter cannot edit once rejected, approved, or withdrawn
  const isTerminalForSubmitter = [
    SubmissionStatus.APPROVED,
    SubmissionStatus.REJECTED,
    SubmissionStatus.WITHDRAWN,
  ].includes(submission.status as SubmissionStatus)
  const canEdit = isSubmitter && !isTerminalForSubmitter
  // Allow comments on any submission (even terminal states) for clarifications
  const canComment = true

  const status =
    statusConfig[submission.status] || statusConfig[SubmissionStatus.PENDING]
  const StatusIcon = status.icon

  const submissionUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${routes.project.submissionDetail({
          slug: params.slug,
          submissionId: submission.id,
          title: submission.bounty.title,
        })}`
      : ''

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(submissionUrl)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendComment = async () => {
    if (!messageContent.trim()) return

    setIsSending(true)
    try {
      await addComment.mutateAsync({
        submissionId: submission.id,
        content: messageContent,
      })
    } catch {
      // Error is handled by onError callback
    } finally {
      setIsSending(false)
    }
  }

  const handleStartEdit = (eventId: string, content: string) => {
    setEditingEventId(eventId)
    setEditContent(content)
  }

  const handleCancelEdit = () => {
    setEditingEventId(null)
    setEditContent('')
  }

  const handleUpdateComment = async () => {
    if (!editingEventId || !editContent.trim()) return
    setIsUpdatingComment(true)
    try {
      await updateComment.mutateAsync({
        eventId: editingEventId,
        content: editContent,
      })
    } catch {
      // Error is handled by onError callback
    } finally {
      setIsUpdatingComment(false)
    }
  }

  const handleSubmitReview = async () => {
    if (reviewAction === 'reject') {
      setShowRejectModal(true)
      return
    }

    if (reviewAction === 'comment') {
      // Just add a comment
      if (!reviewNote.trim()) return
      setIsSending(true)
      try {
        await addComment.mutateAsync({
          submissionId: submission.id,
          content: reviewNote,
        })
        setShowReviewPopover(false)
        setReviewNote('')
      } catch {
        // Error is handled by onError callback
      } finally {
        setIsSending(false)
      }
      return
    }

    setIsSending(true)
    try {
      await reviewSubmission.mutateAsync({
        id: submission.id,
        action: reviewAction === 'approve' ? 'approve' : 'requestInfo',
        note: reviewNote || undefined,
        pointsAwarded:
          reviewAction === 'approve'
            ? (submission.bounty.points ?? undefined)
            : undefined,
      })
    } catch {
      // Error is handled by onError callback
    } finally {
      setIsSending(false)
    }
  }

  const handleReject = async () => {
    setShowRejectModal(false)
    setIsSending(true)
    try {
      await reviewSubmission.mutateAsync({
        id: submission.id,
        action: 'reject',
        note: reviewNote || undefined,
      })
    } catch {
      // Error is handled by onError callback
    } finally {
      setIsSending(false)
    }
  }

  // Sort events chronologically for unified timeline
  const sortedEvents = [...submission.events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl p-6">
        {/* Breadcrumb navigation */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link
            href={routes.project.detail({ slug: params.slug })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {submission.bounty.project.name}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <Link
            href={routes.project.bountyDetail({
              slug: params.slug,
              bountyId: submission.bountyId,
              title: submission.bounty.title,
            })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {submission.bounty.project.projectKey}-{submission.bounty.number}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground">Submission</span>
        </div>

        {/* Header with edit/review buttons */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-muted-foreground sm:text-2xl">
            {submission.bounty.title}
          </h1>

          <div className="flex shrink-0 gap-2">
            {/* Edit button (submitter only, before finalization) */}
            {canEdit && (
              <AppButton variant="outline" size="sm" asChild>
                <Link
                  href={routes.project.submissionEdit({
                    slug: params.slug,
                    submissionId: submission.id,
                    title: submission.bounty.title,
                  })}
                >
                  <Pencil01 className="mr-1.5 size-3.5" />
                  Edit
                </Link>
              </AppButton>
            )}

            {/* Review button (founder only) */}
            {canReview && (
              <Popover
                open={showReviewPopover}
                onOpenChange={setShowReviewPopover}
              >
                <PopoverTrigger asChild>
                  <AppButton size="sm" className="shrink-0 gap-1.5">
                    Review submission
                    <ChevronDown className="size-4" />
                  </AppButton>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-96 p-0">
                  <div className="p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Review summary
                    </p>
                    <AppTextarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          handleSubmitReview()
                        }
                      }}
                      placeholder="Leave a comment..."
                      rows={3}
                      disabled={isSending}
                      className="mb-3 text-sm"
                    />

                    {/* Radio options */}
                    <div className="space-y-2">
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-sm px-2 py-1.5 hover:bg-accent">
                        <input
                          type="radio"
                          name="reviewAction"
                          value="comment"
                          checked={reviewAction === 'comment'}
                          onChange={() => setReviewAction('comment')}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="text-sm font-medium">Comment</div>
                          <div className="text-xs text-muted-foreground">
                            Submit feedback without changing status.
                          </div>
                        </div>
                      </label>

                      <label className="flex cursor-pointer items-start gap-2.5 rounded-sm px-2 py-1.5 hover:bg-accent">
                        <input
                          type="radio"
                          name="reviewAction"
                          value="approve"
                          checked={reviewAction === 'approve'}
                          onChange={() => setReviewAction('approve')}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">Approve</div>
                          <div className="text-xs text-muted-foreground">
                            {submission.bounty.points !== null
                              ? `Award ${submission.bounty.points} points to the contributor.`
                              : 'Award points to the contributor.'}
                          </div>
                          {/* Pool expansion info */}
                          {poolStats &&
                            submission.bounty.points !== null &&
                            poolStats.earnedPoints + submission.bounty.points >
                              poolStats.poolCapacity && (
                              <div className="mt-2 flex items-center rounded-md bg-primary/5 px-2 py-1.5">
                                <span className="text-[11px] text-muted-foreground">
                                  Expands reward pool from{' '}
                                  {poolStats.poolCapacity.toLocaleString()} to{' '}
                                  {(
                                    poolStats.earnedPoints +
                                    submission.bounty.points
                                  ).toLocaleString()}{' '}
                                  pts (
                                  {(
                                    ((poolStats.earnedPoints +
                                      submission.bounty.points -
                                      poolStats.poolCapacity) /
                                      (poolStats.earnedPoints +
                                        submission.bounty.points)) *
                                    100
                                  ).toFixed(1)}
                                  % dilution)
                                </span>
                              </div>
                            )}
                        </div>
                      </label>

                      <label className="flex cursor-pointer items-start gap-2.5 rounded-sm px-2 py-1.5 hover:bg-accent">
                        <input
                          type="radio"
                          name="reviewAction"
                          value="requestInfo"
                          checked={reviewAction === 'requestInfo'}
                          onChange={() => setReviewAction('requestInfo')}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="text-sm font-medium">
                            Request changes
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Ask for more information before approving.
                          </div>
                        </div>
                      </label>

                      <label className="flex cursor-pointer items-start gap-2.5 rounded-sm px-2 py-1.5 hover:bg-accent">
                        <input
                          type="radio"
                          name="reviewAction"
                          value="reject"
                          checked={reviewAction === 'reject'}
                          onChange={() => setReviewAction('reject')}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="text-sm font-medium">Reject</div>
                          <div className="text-xs text-muted-foreground">
                            This submission does not meet requirements.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-border px-3 py-2">
                    <AppButton
                      onClick={handleSubmitReview}
                      disabled={
                        isSending ||
                        (reviewAction === 'comment' && !reviewNote.trim()) ||
                        ((reviewAction === 'requestInfo' ||
                          reviewAction === 'reject') &&
                          !reviewNote.trim())
                      }
                      className="w-full"
                      size="sm"
                    >
                      {isSending && (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      )}
                      Submit review
                    </AppButton>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Main layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_auto_280px]">
          {/* Main content */}
          <div className="space-y-6">
            {/* Submission description */}
            <Markdown markdown={submission.description} proseSize="sm" />

            {/* Activity timeline (events + comments interleaved) */}
            {sortedEvents.length > 0 && (
              <div className="space-y-4">
                {sortedEvents.map((event) => {
                  // Status change events
                  if (event.type === SubmissionEventType.STATUS_CHANGE) {
                    const statusInfo = statusConfig[event.toStatus!]
                    const EventIcon = statusInfo?.icon ?? Clock

                    return (
                      <div key={event.id} className="text-xs">
                        <div className="flex items-start gap-2">
                          <EventIcon
                            className={cn('mt-0.5 size-3.5', statusInfo?.color)}
                          />
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span className="font-medium">
                              {event.user.name}
                            </span>
                            <span className="text-muted-foreground">
                              {event.toStatus === SubmissionStatus.APPROVED &&
                                `approved (+${submission.pointsAwarded} pts)`}
                              {event.toStatus === SubmissionStatus.REJECTED &&
                                'rejected this submission'}
                              {event.toStatus === SubmissionStatus.NEEDS_INFO &&
                                'requested changes'}
                              {event.toStatus === SubmissionStatus.WITHDRAWN &&
                                'withdrew this submission'}
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.createdAt).toLocaleDateString(
                                'en-US',
                                { month: 'short', day: 'numeric' },
                              )}
                            </span>
                          </div>
                        </div>
                        {event.note && (
                          <p className="mt-1 ml-6 text-xs text-muted-foreground">
                            {event.note}
                          </p>
                        )}
                      </div>
                    )
                  }

                  // Edit events
                  if (event.type === SubmissionEventType.EDIT) {
                    return (
                      <div key={event.id} className="text-xs">
                        <div className="flex items-start gap-2">
                          <Pencil01 className="mt-0.5 size-3.5 text-muted-foreground" />
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span className="font-medium">
                              {event.user.name}
                            </span>
                            <span className="text-muted-foreground">
                              edited the submission
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.createdAt).toLocaleDateString(
                                'en-US',
                                { month: 'short', day: 'numeric' },
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // Comment events
                  const isEditing = editingEventId === event.id
                  const isAuthor = event.user.id === session?.user?.id

                  return (
                    <div key={event.id} className="group flex gap-3">
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
                          {event.user.username && (
                            <span className="text-sm text-muted-foreground">
                              @{event.user.username}
                            </span>
                          )}
                          {event.user.id ===
                            submission.bounty.project.founderId && (
                            <Badge
                              variant="outline"
                              className="px-1.5 py-0 text-[10px]"
                            >
                              Owner
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(event.createdAt)}
                          </span>
                        </div>
                        {isEditing ? (
                          <div className="mt-2">
                            <CommentInput
                              value={editContent}
                              onChange={setEditContent}
                              onSubmit={handleUpdateComment}
                              onCancel={handleCancelEdit}
                              isLoading={isUpdatingComment}
                              isEditing
                              placeholder="Edit your comment..."
                            />
                          </div>
                        ) : (
                          <Markdown
                            markdown={event.content!}
                            proseSize="sm"
                            className="mt-1"
                          />
                        )}
                      </div>
                      {!isEditing && isAuthor && canComment && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <AppButton
                              variant="ghost"
                              size="icon-sm"
                              className="size-6 cursor-pointer text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <DotsVertical className="size-3.5" />
                            </AppButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                handleStartEdit(event.id, event.content ?? '')
                              }
                              className="cursor-pointer"
                            >
                              <Edit02 className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add comment */}
            {canComment && session && (
              <CommentInput
                value={messageContent}
                onChange={setMessageContent}
                onSubmit={handleSendComment}
                isLoading={isSending}
                placeholder="Add a comment..."
              />
            )}
          </div>

          {/* Vertical separator */}
          <Separator orientation="vertical" className="hidden lg:block" />

          {/* Sidebar */}
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
                      className={cn('size-4', copied && 'text-primary')}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {copied ? 'Copied!' : 'Copy link'}
                </TooltipContent>
              </Tooltip>
            </div>

            <Separator />

            {/* Properties details */}
            <div className="space-y-3">
              {/* Bounty link - FIRST */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Bounty</span>
                <Link
                  href={routes.project.bountyDetail({
                    slug: params.slug,
                    bountyId: submission.bountyId,
                    title: submission.bounty.title,
                  })}
                  className="text-xs text-primary hover:underline"
                >
                  {submission.bounty.project.projectKey}-
                  {submission.bounty.number}
                </Link>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Status</span>
                <div className={cn('flex items-center gap-1.5', status.color)}>
                  <StatusIcon className="size-4" />
                  <span className="text-xs">{status.label}</span>
                </div>
              </div>

              {/* Points Awarded */}
              {submission.pointsAwarded && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-muted-foreground">
                    Points Awarded
                  </span>
                  <span className="rounded-sm bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    +{submission.pointsAwarded}
                  </span>
                </div>
              )}

              {/* Bounty Points */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">
                  Bounty Points
                </span>
                <span className="rounded-sm bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {submission.bounty.points}
                </span>
              </div>

              {/* Submitted by */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">
                  Submitted by
                </span>
                <div className="flex items-center gap-1.5">
                  <Avatar className="size-5">
                    <AvatarImage src={submission.user.image ?? undefined} />
                    <AvatarFallback className="text-[9px]">
                      {submission.user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs">{submission.user.name}</span>
                </div>
              </div>

              {/* Submitted date */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Submitted</span>
                <span className="text-xs">
                  {new Date(submission.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        title="Reject this submission?"
        description="This will mark the submission as rejected and notify the contributor. You can still approve it later if you change your mind."
        confirmText="Reject Submission"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isSending}
      />
    </AppBackground>
  )
}
