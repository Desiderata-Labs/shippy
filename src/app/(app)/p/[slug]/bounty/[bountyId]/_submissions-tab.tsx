'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  ArrowLeft,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  DotsVertical,
  Edit02,
  FileCheck02,
  Link03,
  MessageTextSquare02,
  Pencil01,
  SlashCircle01,
  XCircle,
} from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AttachmentReferenceType,
  SubmissionEventType,
  SubmissionStatus,
} from '@/lib/db/types'
import {
  submissionStatusColors,
  submissionStatusLabels,
} from '@/lib/status-colors'
import { UploadFolder } from '@/lib/uploads/folders'
import { cn } from '@/lib/utils'
import { AppButton, AppInput, AppTextarea } from '@/components/app'
import { AttachmentList } from '@/components/attachments/attachment-list'
import { CommentInput } from '@/components/comments'
import { SubmissionModal } from '@/components/submission/submission-modal'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Markdown } from '@/components/ui/markdown'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { RelativeTime } from '@/components/ui/relative-time'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SubmissionFilters } from './_submission-filters'
import { useSubmissionFilters } from './use-submission-filters'
import { toast } from 'sonner'

// =============================================================================
// Types
// =============================================================================

interface SubmissionListItem {
  id: string
  status: string
  createdAt: Date
  user: {
    id: string
    name: string
    image: string | null
    username: string | null
  }
  _count: {
    events: number
  }
}

interface SubmissionsTabProps {
  submissions: SubmissionListItem[]
  isFounder: boolean
}

// =============================================================================
// Status Configuration
// =============================================================================

const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof Check }
> = {
  [SubmissionStatus.DRAFT]: {
    label: submissionStatusLabels.DRAFT,
    color: submissionStatusColors.DRAFT.text,
    icon: Circle,
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
    icon: SlashCircle01,
  },
}

// =============================================================================
// Main Component
// =============================================================================

export function SubmissionsTab({
  submissions,
  isFounder,
}: SubmissionsTabProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('id')

  // Use the filter hook
  const { filters, setFilters, statusCounts, filteredSubmissions } =
    useSubmissionFilters({ submissions })

  // Find current index within filtered list
  const currentIndex = selectedId
    ? filteredSubmissions.findIndex((s) => s.id === selectedId)
    : -1

  // Navigation helpers
  const navigateToSubmission = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (id) {
        params.set('id', id)
      } else {
        params.delete('id')
      }
      const query = params.toString()
      router.replace(`${pathname}${query ? `?${query}` : ''}`, {
        scroll: false,
      })
    },
    [router, pathname, searchParams],
  )

  const goToNext = useCallback(() => {
    if (currentIndex < filteredSubmissions.length - 1) {
      navigateToSubmission(filteredSubmissions[currentIndex + 1].id)
    }
  }, [currentIndex, filteredSubmissions, navigateToSubmission])

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      navigateToSubmission(filteredSubmissions[currentIndex - 1].id)
    }
  }, [currentIndex, filteredSubmissions, navigateToSubmission])

  // Keyboard navigation (left/right arrows)
  useEffect(() => {
    if (!selectedId) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      if (e.key === 'ArrowRight' || e.key === 'l') {
        e.preventDefault()
        goToNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'h') {
        e.preventDefault()
        goToPrev()
      } else if (e.key === 'Escape') {
        navigateToSubmission(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, goToNext, goToPrev, navigateToSubmission])

  // Count pending items
  const pendingCount = submissions.filter(
    (s) =>
      s.status === SubmissionStatus.PENDING ||
      s.status === SubmissionStatus.NEEDS_INFO,
  ).length

  // Empty state
  if (submissions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 py-12 text-center">
        <FileCheck02 className="mx-auto mb-3 size-8 text-muted-foreground/50" />
        <h3 className="text-sm font-medium">No submissions yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {isFounder
            ? 'Contributors will submit their work here.'
            : 'Claim this bounty to start working on it.'}
        </p>
      </div>
    )
  }

  // =========================================================================
  // DETAIL VIEW - When a submission is selected
  // =========================================================================
  if (selectedId && currentIndex >= 0) {
    const currentSubmission = filteredSubmissions[currentIndex]
    const status =
      statusConfig[currentSubmission.status] ??
      statusConfig[SubmissionStatus.PENDING]
    const StatusIcon = status.icon

    return (
      <div className="space-y-4">
        {/* Navigation bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-card py-2">
          {/* Back button */}
          <button
            type="button"
            onClick={() => navigateToSubmission(null)}
            className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Back to list</span>
          </button>

          {/* Select dropdown + arrows */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToPrev}
              disabled={currentIndex === 0}
              className={cn(
                'cursor-pointer rounded-md p-1.5 transition-colors',
                currentIndex === 0
                  ? 'cursor-not-allowed text-muted-foreground/30'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              title="Previous (←)"
            >
              <ChevronLeft className="size-4" />
            </button>

            <Select
              value={selectedId}
              onValueChange={(id) => navigateToSubmission(id)}
            >
              <SelectTrigger className="w-auto max-w-[280px] min-w-[180px]">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <StatusIcon className={cn('size-3.5', status.color)} />
                    <span className="truncate">
                      {currentSubmission.user.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({currentIndex + 1}/{filteredSubmissions.length})
                    </span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {filteredSubmissions.map((sub, idx) => {
                  const subStatus =
                    statusConfig[sub.status] ??
                    statusConfig[SubmissionStatus.PENDING]
                  const SubStatusIcon = subStatus.icon
                  return (
                    <SelectItem key={sub.id} value={sub.id}>
                      <div className="flex items-center gap-2">
                        <SubStatusIcon
                          className={cn('size-3.5', subStatus.color)}
                        />
                        <span>{sub.user.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({idx + 1})
                        </span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={goToNext}
              disabled={currentIndex === filteredSubmissions.length - 1}
              className={cn(
                'cursor-pointer rounded-md p-1.5 transition-colors',
                currentIndex === filteredSubmissions.length - 1
                  ? 'cursor-not-allowed text-muted-foreground/30'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              title="Next (→)"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Copy link */}
          <CopyLinkButton />
        </div>

        {/* Full submission content */}
        <SubmissionDetail submissionId={selectedId} isFounder={isFounder} />
      </div>
    )
  }

  // =========================================================================
  // LIST VIEW - No selection
  // =========================================================================
  return (
    <div className="space-y-3">
      {/* Header with filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubmissionFilters
          filters={filters}
          onFiltersChange={setFilters}
          statusCounts={statusCounts}
        />
        <span className="text-xs text-muted-foreground">
          {filteredSubmissions.length} of {submissions.length} submission
          {submissions.length !== 1 && 's'}
          {pendingCount > 0 && (
            <span className="text-purple-500">
              {' '}
              ({pendingCount} awaiting review)
            </span>
          )}
        </span>
      </div>

      {/* List */}
      {filteredSubmissions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No submissions match your filters
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSubmissions.map((submission) => {
            const status =
              statusConfig[submission.status] ??
              statusConfig[SubmissionStatus.PENDING]
            const StatusIcon = status.icon

            return (
              <button
                key={submission.id}
                type="button"
                onClick={() => navigateToSubmission(submission.id)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
              >
                <StatusIcon className={cn('size-4 shrink-0', status.color)} />

                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Avatar className="size-6 shrink-0">
                    <AvatarImage src={submission.user.image ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {submission.user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm font-medium">
                    {submission.user.name}
                  </span>
                  {submission.user.username && (
                    <span className="hidden text-sm text-muted-foreground sm:inline">
                      @{submission.user.username}
                    </span>
                  )}
                </div>

                <Badge
                  variant="outline"
                  className={cn('shrink-0 text-[10px]', status.color)}
                >
                  {status.label}
                </Badge>

                {submission._count.events > 0 && (
                  <div className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
                    <MessageTextSquare02 className="size-3" />
                    {submission._count.events}
                  </div>
                )}

                <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                  {new Date(submission.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Copy Link Button
// =============================================================================

function CopyLinkButton() {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleCopy}
          className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Link03 className={cn('size-4', copied && 'text-primary')} />
        </button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied!' : 'Copy link'}</TooltipContent>
    </Tooltip>
  )
}

// =============================================================================
// Submission Detail Component (Full width, inline)
// =============================================================================

type ReviewAction = 'comment' | 'approve' | 'requestInfo' | 'reject'

interface SubmissionDetailProps {
  submissionId: string
  isFounder: boolean
}

function SubmissionDetail({ submissionId, isFounder }: SubmissionDetailProps) {
  const { data: session } = useSession()
  const [reviewNote, setReviewNote] = useState('')
  const [reviewAction, setReviewAction] = useState<ReviewAction>('approve')
  const [pointsAwardedInput, setPointsAwardedInput] = useState('')
  const [showReviewPopover, setShowReviewPopover] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [messageContent, setMessageContent] = useState('')
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isUpdatingComment, setIsUpdatingComment] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  // Dismiss review popover on scroll (listen on document to catch all scroll events)
  useEffect(() => {
    if (!showReviewPopover) return

    const handleScroll = () => setShowReviewPopover(false)
    document.addEventListener('scroll', handleScroll, {
      passive: true,
      capture: true,
    })
    return () =>
      document.removeEventListener('scroll', handleScroll, { capture: true })
  }, [showReviewPopover])

  const { data: submission, isLoading } = trpc.submission.getById.useQuery(
    { id: submissionId },
    { enabled: !!submissionId },
  )

  useEffect(() => {
    if (!submission) return
    setPointsAwardedInput(String(submission.bounty.points ?? ''))
  }, [submission])

  const utils = trpc.useUtils()

  const addComment = trpc.submission.addComment.useMutation({
    onSuccess: () => {
      setMessageContent('')
      utils.submission.getById.invalidate({ id: submissionId })
    },
    onError: (error) => toast.error(error.message),
  })

  const updateComment = trpc.submission.updateComment.useMutation({
    onSuccess: () => {
      utils.submission.getById.invalidate({ id: submissionId })
      toast.success('Comment updated')
      setEditingEventId(null)
      setEditContent('')
    },
    onError: (error) => toast.error(error.message),
  })

  const reviewSubmission = trpc.submission.review.useMutation({
    onSuccess: (_, variables) => {
      const action = variables.action
      toast.success(
        action === 'approve'
          ? 'Submission approved!'
          : action === 'reject'
            ? 'Submission rejected'
            : 'Changes requested',
      )
      setShowReviewPopover(false)
      setShowRejectModal(false)
      setReviewNote('')
      utils.submission.getById.invalidate({ id: submissionId })
      utils.bounty.getById.invalidate()
    },
    onError: (error) => toast.error(error.message),
  })

  const handleSubmitReview = async () => {
    if (!submission) return

    if (reviewAction === 'reject') {
      setShowRejectModal(true)
      return
    }

    if (reviewAction === 'comment') {
      if (!reviewNote.trim()) return
      setIsSending(true)
      try {
        await addComment.mutateAsync({
          submissionId: submission.id,
          content: reviewNote,
        })
        setShowReviewPopover(false)
        setReviewNote('')
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
          reviewAction === 'approve' && pointsAwarded >= bountyPoints
            ? pointsAwarded
            : undefined,
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleReject = async () => {
    if (!submission) return
    setIsSending(true)
    try {
      await reviewSubmission.mutateAsync({
        id: submission.id,
        action: 'reject',
        note: reviewNote || undefined,
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleSendComment = async () => {
    if (!submission || !messageContent.trim()) return
    setIsSending(true)
    try {
      await addComment.mutateAsync({
        submissionId: submission.id,
        content: messageContent,
      })
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
    } finally {
      setIsUpdatingComment(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!submission) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">Submission not found</p>
      </div>
    )
  }

  const status =
    statusConfig[submission.status] ?? statusConfig[SubmissionStatus.PENDING]
  const isTerminal = [
    SubmissionStatus.APPROVED,
    SubmissionStatus.WITHDRAWN,
  ].includes(submission.status as SubmissionStatus)
  const canReview = isFounder && !isTerminal
  const isAuthorOfSubmission = session?.user?.id === submission.userId
  const canEdit = isAuthorOfSubmission && !isTerminal
  const sortedEvents = [...submission.events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  const bountyPoints = submission.bounty.points ?? 0
  const pointsAwarded = parseInt(pointsAwardedInput, 10) || 0
  const approvePointsLabel = pointsAwarded || bountyPoints || '?'

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarImage src={submission.user.image ?? undefined} />
            <AvatarFallback className="text-xs">
              {submission.user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{submission.user.name}</span>
              {submission.user.username && (
                <span className="text-sm text-muted-foreground">
                  @{submission.user.username}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RelativeTime date={submission.createdAt} />
              <span>·</span>
              <span className={status.color}>{status.label}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Edit button for submission author */}
          {canEdit && (
            <AppButton
              size="sm"
              variant="outline"
              className="cursor-pointer gap-1.5"
              onClick={() => setShowEditModal(true)}
            >
              <Edit02 className="size-3.5" />
              Edit
            </AppButton>
          )}

          {/* Review button */}
          {canReview && (
            <Popover
              open={showReviewPopover}
              onOpenChange={setShowReviewPopover}
            >
              <PopoverTrigger asChild>
                <AppButton size="sm" className="cursor-pointer gap-1.5">
                  Review
                  <ChevronDown className="size-3.5" />
                </AppButton>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Review note (optional for approve)
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
                    placeholder="Leave a note..."
                    rows={2}
                    disabled={isSending}
                    className="mb-3 text-sm"
                  />

                  <div className="space-y-1.5">
                    {[
                      {
                        value: 'approve',
                        label: 'Approve',
                        desc: `Award ${approvePointsLabel} points`,
                      },
                      {
                        value: 'requestInfo',
                        label: 'Request changes',
                        desc: 'Ask for more info',
                      },
                      {
                        value: 'reject',
                        label: 'Reject',
                        desc: 'Does not meet requirements',
                      },
                      {
                        value: 'comment',
                        label: 'Comment only',
                        desc: 'No status change',
                      },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent"
                      >
                        <input
                          type="radio"
                          name="reviewAction"
                          value={opt.value}
                          checked={reviewAction === opt.value}
                          onChange={() =>
                            setReviewAction(opt.value as ReviewAction)
                          }
                          className="cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{opt.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {opt.desc}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {reviewAction === 'approve' && (
                    <div className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">
                          Points to award
                        </span>
                        <AppInput
                          type="number"
                          min={bountyPoints}
                          value={pointsAwardedInput}
                          onChange={(e) =>
                            setPointsAwardedInput(e.target.value)
                          }
                          onBlur={() => {
                            if (!pointsAwardedInput.trim()) return
                            if (pointsAwarded < bountyPoints) {
                              setPointsAwardedInput(String(bountyPoints))
                            }
                          }}
                          disabled={isSending}
                          className="h-8 w-24 text-center text-sm font-semibold"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-border px-3 py-2">
                  <AppButton
                    onClick={handleSubmitReview}
                    disabled={
                      isSending ||
                      (reviewAction === 'approve' &&
                        pointsAwarded < bountyPoints) ||
                      (reviewAction === 'comment' && !reviewNote.trim()) ||
                      ((reviewAction === 'requestInfo' ||
                        reviewAction === 'reject') &&
                        !reviewNote.trim())
                    }
                    className="w-full cursor-pointer"
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

      {/* Content */}
      <div className="p-4">
        {/* Submission description */}
        <Markdown markdown={submission.description} proseSize="sm" />

        {/* Attachments */}
        <div className="mt-4">
          <AttachmentList
            referenceType={AttachmentReferenceType.SUBMISSION}
            referenceId={submission.id}
          />
        </div>

        {/* Activity timeline */}
        {sortedEvents.length > 0 && (
          <div className="mt-6 space-y-4">
            <Separator />
            <h4 className="text-xs font-medium text-muted-foreground">
              Activity
            </h4>
            {sortedEvents.map((event) => {
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
                        <span className="font-medium">{event.user.name}</span>
                        <span className="text-muted-foreground">
                          {event.toStatus === SubmissionStatus.APPROVED &&
                            `approved (+${submission.pointsAwarded} pts)`}
                          {event.toStatus === SubmissionStatus.REJECTED &&
                            'rejected'}
                          {event.toStatus === SubmissionStatus.NEEDS_INFO &&
                            'requested changes'}
                          {event.toStatus === SubmissionStatus.WITHDRAWN &&
                            'withdrew'}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <RelativeTime
                          date={event.createdAt}
                          className="text-muted-foreground"
                        />
                      </div>
                    </div>
                    {event.note && (
                      <p className="mt-1 ml-6 text-muted-foreground">
                        {event.note}
                      </p>
                    )}
                  </div>
                )
              }

              if (event.type === SubmissionEventType.EDIT) {
                return (
                  <div key={event.id} className="text-xs">
                    <div className="flex items-start gap-2">
                      <Pencil01 className="mt-0.5 size-3.5 text-muted-foreground" />
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{event.user.name}</span>
                        <span className="text-muted-foreground">
                          edited submission
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <RelativeTime
                          date={event.createdAt}
                          className="text-muted-foreground"
                        />
                      </div>
                    </div>
                  </div>
                )
              }

              // Comment event
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
                      {event.user.id ===
                        submission.bounty.project.founderId && (
                        <Badge
                          variant="outline"
                          className="px-1.5 py-0 text-[10px]"
                        >
                          Owner
                        </Badge>
                      )}
                      <RelativeTime
                        date={event.createdAt}
                        className="text-xs text-muted-foreground"
                      />
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
                          enableUploads
                          uploadFolder={UploadFolder.SUBMISSIONS}
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
                  {!isEditing && isAuthor && (
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

        {/* Comment input */}
        {session && (
          <div className="mt-10">
            <CommentInput
              value={messageContent}
              onChange={setMessageContent}
              onSubmit={handleSendComment}
              isLoading={isSending && !showReviewPopover}
              placeholder="Add a comment..."
              enableUploads
              uploadFolder={UploadFolder.SUBMISSIONS}
            />
          </div>
        )}
      </div>

      {/* Reject confirmation modal */}
      <ConfirmModal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        title="Reject this submission?"
        description="This will mark the submission as rejected. You can still approve it later."
        confirmText="Reject"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isSending}
      />

      {/* Edit submission modal */}
      <SubmissionModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        mode="edit"
        bountyId={submission.bountyId}
        submissionId={submission.id}
      />
    </div>
  )
}
