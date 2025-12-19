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
  File06,
  FileCheck02,
  FileCheck03,
  Lightbulb01,
  Link03,
  Pencil01,
  Plus,
  RefreshCcw01,
  RefreshCw01,
  SlashCircle01,
  Target01,
  Trash01,
  User01,
  Users01,
  XCircle,
} from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import {
  allowsMultipleClaims,
  getClaimModeInfo,
} from '@/lib/bounty/claim-modes'
import { getLabelColor } from '@/lib/bounty/tag-colors'
import {
  AttachmentReferenceType,
  BountyClaimMode,
  BountyEventType,
  BountyStatus,
  ClaimStatus,
  SubmissionStatus,
  generateRandomLabelColor,
} from '@/lib/db/types'
import { extractNanoIdFromSlug } from '@/lib/nanoid/shared'
import { ProjectTab, routes } from '@/lib/routes'
import {
  bountyStatusColors,
  bountyStatusLabels,
  submissionStatusColors,
  submissionStatusLabels,
} from '@/lib/status-colors'
import { UploadFolder } from '@/lib/uploads/folders'
import { cn } from '@/lib/utils'
import { AppButton } from '@/components/app'
import { AttachmentList } from '@/components/attachments/attachment-list'
import { CommentInput } from '@/components/comments'
import { AppBackground } from '@/components/layout/app-background'
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
import { ErrorState } from '@/components/ui/error-state'
import { Markdown } from '@/components/ui/markdown'
import { NotFoundState } from '@/components/ui/not-found-state'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { RelativeTime } from '@/components/ui/relative-time'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SubmissionsTab } from './_submissions-tab'
import { toast } from 'sonner'

type BountyTab = 'details' | 'submissions'

const DEFAULT_BOUNTY_TAB: BountyTab = 'details'

function isValidBountyTab(tab: string | null): tab is BountyTab {
  return tab === 'details' || tab === 'submissions'
}

export function BountyDetailContent() {
  const params = useParams<{ slug: string; bountyId: string }>()
  const searchParams = useSearchParams()
  // Extract the nanoid from the URL slug (e.g., "grow-audience-TdFKukO9LuJe" -> "TdFKukO9LuJe")
  const bountyId = extractNanoIdFromSlug(params.bountyId)
  const { data: session } = useSession()

  // Tab state from URL
  const tabParam = searchParams.get('tab')
  const activeTab = isValidBountyTab(tabParam) ? tabParam : DEFAULT_BOUNTY_TAB

  const [isClaiming, setIsClaiming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [releaseReason, setReleaseReason] = useState('')
  const [newComment, setNewComment] = useState('')
  const [isPostingComment, setIsPostingComment] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<string | null>(null)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isUpdatingComment, setIsUpdatingComment] = useState(false)

  // Close/reopen state
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closeReason, setCloseReason] = useState('')

  // Suggestion approval state
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // Label management state
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [showCreateLabel, setShowCreateLabel] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(() =>
    generateRandomLabelColor(),
  )

  // Submission modal state
  const [showSubmissionModal, setShowSubmissionModal] = useState(false)

  const {
    data: bounty,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.bounty.getById.useQuery(
    { id: bountyId },
    { enabled: !!bountyId, retry: false },
  )

  const utils = trpc.useUtils()

  const claimBounty = trpc.bounty.claim.useMutation({
    onSuccess: () => {
      toast.success('Bounty claimed! You can now start working on it.')
      utils.bounty.getById.invalidate({ id: bountyId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const releaseClaim = trpc.bounty.releaseClaim.useMutation({
    onSuccess: () => {
      toast.success('Claim released')
      utils.bounty.getById.invalidate({ id: bountyId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const addComment = trpc.bounty.addComment.useMutation({
    onSuccess: () => {
      setNewComment('')
      utils.bounty.getById.invalidate({ id: bountyId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deleteComment = trpc.bounty.deleteComment.useMutation({
    onSuccess: () => {
      utils.bounty.getById.invalidate({ id: bountyId })
      toast.success('Comment deleted')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const updateComment = trpc.bounty.updateComment.useMutation({
    onSuccess: () => {
      utils.bounty.getById.invalidate({ id: bountyId })
      toast.success('Comment updated')
      setEditingEventId(null)
      setEditContent('')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Fetch project labels for the label picker
  const { data: projectLabels } = trpc.label.getByProject.useQuery(
    { projectId: bounty?.project.id ?? '' },
    { enabled: !!bounty?.project.id },
  )

  const createLabel = trpc.label.create.useMutation({
    onSuccess: (label) => {
      toast.success(`Label "${label.name}" created`)
      utils.label.getByProject.invalidate({ projectId: bounty?.project.id })
      setNewLabelName('')
      setNewLabelColor(generateRandomLabelColor())
      setShowCreateLabel(false)
      // Auto-add to bounty
      if (bounty) {
        const currentLabelIds = bounty.labels.map((l) => l.label.id)
        updateBountyLabels.mutate({
          id: bounty.id,
          labelIds: [...currentLabelIds, label.id],
        })
      }
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const updateBountyLabels = trpc.bounty.update.useMutation({
    onSuccess: () => {
      utils.bounty.getById.invalidate({ id: bountyId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const closeBounty = trpc.bounty.close.useMutation({
    onSuccess: () => {
      toast.success('Bounty closed')
      utils.bounty.getById.invalidate({ id: bountyId })
      setShowCloseModal(false)
      setCloseReason('')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const reopenBounty = trpc.bounty.reopen.useMutation({
    onSuccess: () => {
      toast.success('Bounty reopened')
      utils.bounty.getById.invalidate({ id: bountyId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const approveSuggestion = trpc.bounty.approveSuggestion.useMutation({
    onSuccess: () => {
      toast.success('Suggestion approved!')
      utils.bounty.getById.invalidate({ id: bountyId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const rejectSuggestion = trpc.bounty.rejectSuggestion.useMutation({
    onSuccess: () => {
      toast.success('Suggestion rejected')
      utils.bounty.getById.invalidate({ id: bountyId })
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
              resourceType="bounty"
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

  if (!bounty) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          <NotFoundState
            resourceType="bounty"
            backHref={routes.project.detail({ slug: params.slug })}
            backLabel="Back to Project"
          />
        </div>
      </AppBackground>
    )
  }

  const userClaim = bounty.claims.find((c) => c.userId === session?.user?.id)
  const hasActiveClaim = userClaim?.status === ClaimStatus.ACTIVE
  const hasSubmittedClaim = userClaim?.status === ClaimStatus.SUBMITTED
  const isFounder = session?.user?.id === bounty.project.founderId
  // User can claim if:
  // - Logged in
  // - Doesn't already have a claim
  // - Bounty is OPEN, or CLAIMED but in a multi-claim mode
  // - maxClaims limit not reached (if set)
  const isAtMaxClaims =
    bounty.maxClaims !== null && bounty.claims.length >= bounty.maxClaims
  const canClaim =
    session &&
    !userClaim &&
    !isAtMaxClaims &&
    (bounty.status === BountyStatus.OPEN ||
      (bounty.status === BountyStatus.CLAIMED &&
        allowsMultipleClaims(bounty.claimMode as BountyClaimMode)))

  const handleClaim = async () => {
    setIsClaiming(true)
    try {
      await claimBounty.mutateAsync({ bountyId: bounty.id })
    } catch {
      // Error is handled by onError callback
    } finally {
      setIsClaiming(false)
    }
  }

  const handleReleaseClaim = async () => {
    if (!userClaim) return
    setIsClaiming(true)
    try {
      await releaseClaim.mutateAsync({
        claimId: userClaim.id,
        reason: releaseReason.trim() || undefined,
      })
      setShowReleaseModal(false)
      setReleaseReason('')
    } catch {
      // Error is handled by onError callback
    } finally {
      setIsClaiming(false)
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
    } catch {
      // Error is handled by onError callback
    } finally {
      setIsPostingComment(false)
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

  const commitmentDate = bounty.project.rewardPool?.commitmentEndsAt
  const commitmentRemaining = commitmentDate
    ? Math.ceil(
        (new Date(commitmentDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null
  // Check if commitment is "forever" (more than 100 years away)
  const isForeverCommitment =
    commitmentRemaining !== null && commitmentRemaining > 365 * 100

  const bountyDisplayId = `${bounty.project.projectKey}-${bounty.number}`

  // Build bounty URL for sharing - constructed on demand to avoid hydration issues
  const getBountyUrl = () => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}${routes.project.bountyDetail({
      slug: params.slug,
      bountyId: bounty.id,
      title: bounty.title,
    })}`
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(getBountyUrl())
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  // Status icon helper
  const StatusIcon = ({ size = 'md' }: { size?: 'sm' | 'md' }) => {
    const sizeClass = size === 'sm' ? 'size-4' : 'size-5'
    const colorClass =
      bountyStatusColors[bounty.status as BountyStatus]?.icon ??
      bountyStatusColors.OPEN.icon

    if (bounty.status === BountyStatus.SUGGESTED) {
      return <Lightbulb01 className={cn(sizeClass, colorClass)} />
    }
    if (bounty.status === BountyStatus.COMPLETED) {
      return <CheckCircle className={cn(sizeClass, colorClass)} />
    }
    if (bounty.status === BountyStatus.CLOSED) {
      return <XCircle className={cn(sizeClass, colorClass)} />
    }
    if (bounty.status === BountyStatus.CLAIMED) {
      return <Clock className={cn(sizeClass, colorClass)} />
    }
    if (bounty.status === BountyStatus.BACKLOG) {
      return <Circle className={cn(sizeClass, colorClass, 'opacity-50')} />
    }
    return <Circle className={cn(sizeClass, colorClass)} />
  }

  const statusLabel =
    bountyStatusLabels[bounty.status as BountyStatus] ?? 'Open'

  // Find approved submission if any (used for determining assignees)
  const approvedSubmission = bounty.submissions.find(
    (s) => s.status === SubmissionStatus.APPROVED,
  )

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl p-6">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(bountyDisplayId)
                  toast.success('Copied!')
                }}
                className="cursor-pointer rounded-sm px-1 py-0.5 text-foreground transition-colors hover:bg-accent"
              >
                {bountyDisplayId}
              </button>
            </TooltipTrigger>
            <TooltipContent>Click to copy</TooltipContent>
          </Tooltip>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {bounty.title}
          </h1>
          {isFounder && (
            <div className="flex shrink-0 items-center gap-2">
              {/* Edit button */}
              {bounty.status === BountyStatus.COMPLETED ||
              bounty.status === BountyStatus.CLOSED ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <AppButton variant="outline" size="sm" disabled>
                        <Pencil01 className="mr-1.5 size-3.5" />
                        Edit
                      </AppButton>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {bounty.status === BountyStatus.COMPLETED
                      ? 'Completed bounties cannot be edited'
                      : 'Closed bounties cannot be edited'}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <AppButton variant="outline" size="sm" asChild>
                  <Link
                    href={routes.project.bountyEdit({
                      slug: params.slug,
                      bountyId: bounty.id,
                      title: bounty.title,
                    })}
                  >
                    <Pencil01 className="mr-1.5 size-3.5" />
                    Edit
                  </Link>
                </AppButton>
              )}

              {/* Close/Reopen dropdown */}
              {bounty.status !== BountyStatus.COMPLETED && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <AppButton
                      variant="ghost"
                      size="icon-sm"
                      className="cursor-pointer"
                    >
                      <DotsVertical className="size-4" />
                    </AppButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {bounty.status === BountyStatus.CLOSED ? (
                      <DropdownMenuItem
                        onClick={() =>
                          reopenBounty.mutate({ bountyId: bounty.id })
                        }
                        disabled={reopenBounty.isPending}
                        className="cursor-pointer"
                      >
                        <RefreshCw01 className="mr-2 size-4" />
                        {reopenBounty.isPending ? 'Reopening...' : 'Reopen'}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => setShowCloseModal(true)}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <SlashCircle01 className="mr-2 size-4" />
                        Close Bounty
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>

        {/* Suggested bounty approval banner for founders */}
        {bounty.status === BountyStatus.SUGGESTED && isFounder && (
          <div className="mb-6 rounded-lg border bg-primary/5 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Lightbulb01 className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    This bounty was suggested by{' '}
                    {bounty.suggestedBy?.username ? (
                      <Link
                        href={routes.user.profile({
                          username: bounty.suggestedBy.username,
                        })}
                        className="text-foreground hover:underline"
                      >
                        @{bounty.suggestedBy.username}
                      </Link>
                    ) : (
                      'a contributor'
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Review the suggestion and approve it to make it claimable,
                    or reject it with feedback.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <AppButton
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRejectModal(true)}
                  disabled={rejectSuggestion.isPending}
                  className="cursor-pointer"
                >
                  {rejectSuggestion.isPending ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <XCircle className="mr-1.5 size-3.5" />
                  )}
                  Reject
                </AppButton>
                <AppButton
                  size="sm"
                  onClick={() =>
                    approveSuggestion.mutate({ bountyId: bounty.id })
                  }
                  disabled={approveSuggestion.isPending}
                  className="cursor-pointer"
                >
                  {approveSuggestion.isPending ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-1.5 size-3.5" />
                  )}
                  Approve to Backlog
                </AppButton>
              </div>
            </div>
          </div>
        )}

        {/* Tab navigation */}
        <div className="mb-6 border-b border-border">
          <nav
            className="scrollbar-hide -mb-px flex gap-0.5 overflow-x-auto"
            aria-label="Bounty tabs"
          >
            {(
              [
                {
                  value: 'details',
                  label: 'Details',
                  icon: File06,
                },
                {
                  value: 'submissions',
                  label: 'Submissions',
                  icon: FileCheck02,
                  count: bounty.submissions.length,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.value
              const href = routes.project.bountyDetail({
                slug: params.slug,
                bountyId: bounty.id,
                title: bounty.title,
                tab: tab.value === 'details' ? undefined : tab.value,
              })

              return (
                <Link
                  key={tab.value}
                  href={href}
                  scroll={false}
                  className={cn(
                    'group relative flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors sm:gap-2 sm:px-4',
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="size-4" />
                  <span>{tab.label}</span>
                  {'count' in tab &&
                    tab.count !== undefined &&
                    tab.count > 0 && (
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-xs font-medium',
                          isActive
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground group-hover:bg-accent',
                        )}
                      >
                        {tab.count}
                      </span>
                    )}

                  {/* Active indicator */}
                  {isActive && (
                    <span className="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-primary" />
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Main layout - full width when on submissions tab for review queue */}
        <div
          className={cn(
            'grid gap-6',
            activeTab === 'details' && 'lg:grid-cols-[1fr_auto_280px]',
          )}
        >
          {/* Main content */}
          <div className={cn(activeTab === 'details' && 'space-y-6')}>
            {/* Details tab content */}
            {activeTab === 'details' && (
              <>
                {/* Description */}
                <Markdown markdown={bounty.description} proseSize="sm" />

                {/* Attachments */}
                <AttachmentList
                  referenceType={AttachmentReferenceType.BOUNTY}
                  referenceId={bounty.id}
                />

                {/* Acceptance Criteria */}
                {bounty.evidenceDescription && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex gap-3">
                      <FileCheck03 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          Acceptance Criteria
                        </p>
                        <Markdown
                          markdown={bounty.evidenceDescription}
                          proseSize="sm"
                          className="mt-1 text-muted-foreground"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Activity timeline (events + submissions + github links interleaved) */}
                <div className="space-y-4">
                  {(() => {
                    // Create unified timeline of events, submissions, and github links
                    type TimelineItem =
                      | { type: 'event'; data: (typeof bounty.events)[0] }
                      | {
                          type: 'submission'
                          data: (typeof bounty.submissions)[0]
                        }
                      | {
                          type: 'githubIssueLink'
                          data: NonNullable<typeof bounty.githubIssueLink>
                        }

                    const timeline: TimelineItem[] = [
                      ...bounty.events.map((e) => ({
                        type: 'event' as const,
                        data: e,
                      })),
                      ...bounty.submissions.map((s) => ({
                        type: 'submission' as const,
                        data: s,
                      })),
                      // Add GitHub issue link if present
                      ...(bounty.githubIssueLink
                        ? [
                            {
                              type: 'githubIssueLink' as const,
                              data: bounty.githubIssueLink,
                            },
                          ]
                        : []),
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
                        label: submissionStatusLabels.DRAFT.toLowerCase(),
                        color: submissionStatusColors.DRAFT.text,
                      },
                      [SubmissionStatus.PENDING]: {
                        label: submissionStatusLabels.PENDING.toLowerCase(),
                        color: submissionStatusColors.PENDING.text,
                      },
                      [SubmissionStatus.NEEDS_INFO]: {
                        label: submissionStatusLabels.NEEDS_INFO.toLowerCase(),
                        color: submissionStatusColors.NEEDS_INFO.text,
                      },
                      [SubmissionStatus.APPROVED]: {
                        label: submissionStatusLabels.APPROVED.toLowerCase(),
                        color: submissionStatusColors.APPROVED.text,
                      },
                      [SubmissionStatus.REJECTED]: {
                        label: submissionStatusLabels.REJECTED.toLowerCase(),
                        color: submissionStatusColors.REJECTED.text,
                      },
                      [SubmissionStatus.WITHDRAWN]: {
                        label: submissionStatusLabels.WITHDRAWN.toLowerCase(),
                        color: submissionStatusColors.WITHDRAWN.text,
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
                      // GitHub issue link (bounty created from GitHub issue)
                      if (item.type === 'githubIssueLink') {
                        const issueLink = item.data
                        return (
                          <div
                            key={`gh-issue-${issueLink.id}`}
                            className="text-xs"
                          >
                            <div className="flex items-start gap-2">
                              <Link03 className="mt-0.5 size-3.5 text-muted-foreground" />
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="text-muted-foreground">
                                  Linked to GitHub issue
                                </span>
                                <a
                                  href={`https://github.com/${bounty.project.githubConnection?.repoFullName}/issues/${issueLink.issueNumber}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  #{issueLink.issueNumber}
                                </a>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(
                                    issueLink.createdAt,
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

                      if (item.type === 'submission') {
                        const submission = item.data
                        const status =
                          submissionStatusConfig[submission.status] ??
                          submissionStatusConfig[SubmissionStatus.PENDING]

                        return (
                          <div key={`sub-${submission.id}`} className="text-xs">
                            <div className="flex items-start gap-2">
                              <Check className="mt-0.5 size-3.5 text-primary" />
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="font-medium">
                                  {submission.user.name}
                                </span>
                                <span className="text-muted-foreground">
                                  submitted work
                                </span>
                                {submission.githubPRLink && (
                                  <>
                                    <span className="text-muted-foreground">
                                      via
                                    </span>
                                    <a
                                      href={submission.githubPRLink.prUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline"
                                    >
                                      PR #{submission.githubPRLink.prNumber}
                                    </a>
                                  </>
                                )}
                                <span className={cn('text-xs', status.color)}>
                                  ({status.label})
                                </span>
                                <span className="text-muted-foreground">·</span>
                                <Link
                                  href={routes.project.submissionDetail({
                                    slug: params.slug,
                                    bountyId: bounty.id,
                                    submissionId: submission.id,
                                    title: bounty.title,
                                  })}
                                  className="text-primary hover:underline"
                                >
                                  Review Submission →
                                </Link>
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
                          <div key={`evt-${event.id}`} className="text-xs">
                            <div className="flex items-start gap-2">
                              <Pencil01 className="mt-0.5 size-3.5 text-muted-foreground" />
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="font-medium">
                                  {event.user.name}
                                </span>
                                <span className="text-muted-foreground">
                                  edited
                                  {changedFields ? ` ${changedFields}` : ''}
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
                          [BountyStatus.SUGGESTED]: 'Suggested',
                          [BountyStatus.BACKLOG]: 'Backlog',
                          [BountyStatus.OPEN]: 'Open',
                          [BountyStatus.CLAIMED]: 'In Progress',
                          [BountyStatus.COMPLETED]: 'Completed',
                          [BountyStatus.CLOSED]: 'Closed',
                        }
                        const isClosed = event.toStatus === BountyStatus.CLOSED
                        const isReopened =
                          event.fromStatus === BountyStatus.CLOSED &&
                          event.toStatus !== BountyStatus.CLOSED

                        return (
                          <div key={`evt-${event.id}`} className="text-xs">
                            <div className="flex items-start gap-2">
                              {isClosed ? (
                                <SlashCircle01 className="mt-0.5 size-3.5 text-muted-foreground" />
                              ) : isReopened ? (
                                <RefreshCw01 className="mt-0.5 size-3.5 text-muted-foreground" />
                              ) : (
                                <Edit02 className="mt-0.5 size-3.5 text-muted-foreground" />
                              )}
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                  <span className="font-medium">
                                    {event.user.name}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {isClosed
                                      ? 'closed this bounty'
                                      : isReopened
                                        ? 'reopened this bounty'
                                        : `changed status from ${statusLabels[event.fromStatus ?? ''] || event.fromStatus} to ${statusLabels[event.toStatus ?? ''] || event.toStatus}`}
                                  </span>
                                  <span className="text-muted-foreground">
                                    ·
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(
                                      event.createdAt,
                                    ).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                </div>
                                {/* Show reason/content if present (e.g., close reason) */}
                                {event.content && (
                                  <div className="rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
                                    {event.content}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      }

                      // Comment event
                      const isEditing = editingEventId === event.id
                      const isAuthor = event.userId === session?.user?.id

                      return (
                        <div
                          key={`evt-${event.id}`}
                          className="group flex gap-3"
                        >
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
                                  uploadFolder={UploadFolder.BOUNTIES}
                                />
                              </div>
                            ) : (
                              <Markdown
                                markdown={event.content ?? ''}
                                proseSize="sm"
                                className="mt-1"
                              />
                            )}
                          </div>
                          {!isEditing && (isAuthor || isFounder) && (
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
                                {isAuthor && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleStartEdit(
                                        event.id,
                                        event.content ?? '',
                                      )
                                    }
                                    className="cursor-pointer"
                                  >
                                    <Edit02 className="mr-2 size-4" />
                                    Edit
                                  </DropdownMenuItem>
                                )}
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
                      enableUploads
                      uploadFolder={UploadFolder.BOUNTIES}
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
              </>
            )}

            {/* Submissions tab content */}
            {activeTab === 'submissions' && (
              <SubmissionsTab
                submissions={bounty.submissions}
                isFounder={isFounder}
              />
            )}
          </div>

          {/* Vertical separator - only on details tab */}
          {activeTab === 'details' && (
            <Separator orientation="vertical" className="hidden lg:block" />
          )}

          {/* Sidebar - Linear style properties panel - only on details tab */}
          {activeTab === 'details' && (
            <div className="sticky top-4 space-y-4 self-start">
              {/* Properties header */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Properties
                </span>
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

              {/* Actions */}
              {bounty.status === BountyStatus.SUGGESTED ? (
                <div className="rounded-md bg-primary/5 px-3 py-2 text-center text-xs text-muted-foreground/75">
                  <Lightbulb01 className="mx-auto mb-1 size-4" />
                  {isFounder
                    ? 'Review this suggestion above'
                    : 'Awaiting founder approval'}
                </div>
              ) : bounty.status === BountyStatus.COMPLETED ? (
                <div className="rounded-md bg-primary/10 px-3 py-2 text-center text-xs text-primary">
                  <CheckCircle className="mx-auto mb-1 size-4" />
                  This bounty has been completed
                </div>
              ) : bounty.status === BountyStatus.CLOSED ? (
                <div className="rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
                  This bounty is closed and no longer accepting submissions.
                </div>
              ) : !session ? (
                <AppButton asChild className="w-full" size="sm">
                  <Link href={routes.auth.signIn()}>Sign In to Claim</Link>
                </AppButton>
              ) : hasActiveClaim ? (
                <div className="space-y-2">
                  <AppButton
                    className="w-full cursor-pointer"
                    size="sm"
                    onClick={() => setShowSubmissionModal(true)}
                  >
                    <Check className="mr-1.5 size-3.5" />
                    Submit Work
                  </AppButton>
                  <AppButton
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReleaseModal(true)}
                    className="w-full cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    Release Claim
                  </AppButton>
                </div>
              ) : hasSubmittedClaim ? (
                <AppButton
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReleaseModal(true)}
                  className="w-full cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  Release Claim
                </AppButton>
              ) : canClaim ? (
                <AppButton
                  onClick={handleClaim}
                  disabled={isClaiming}
                  className="w-full"
                  size="sm"
                >
                  {isClaiming && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  <Target01 className="mr-1.5 size-3.5" />
                  Claim Bounty
                </AppButton>
              ) : bounty.status === BountyStatus.BACKLOG ? (
                <div className="rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
                  This bounty is in the backlog and can&apos;t be claimed yet.
                  Points will be assigned later.
                </div>
              ) : isAtMaxClaims ? (
                <div className="rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
                  This bounty has reached its maximum number of claimants (
                  {bounty.maxClaims}).
                </div>
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
                  <span
                    className={cn(
                      'rounded-sm px-2 py-0.5 text-xs font-semibold',
                      bounty.points !== null
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {bounty.points !== null ? `+${bounty.points}` : 'TBD'}
                  </span>
                </div>

                {/* Points earnings estimate */}
                {bounty.project.rewardPool && bounty.points !== null && (
                  <div className="rounded-md bg-primary/5 px-3 py-2 text-right text-xs text-muted-foreground/70">
                    (e.g. $
                    {(
                      (10000 *
                        bounty.project.rewardPool.poolPercentage *
                        (bounty.points /
                          bounty.project.rewardPool.poolCapacity)) /
                      100
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}{' '}
                    paid per $10k profit)
                  </div>
                )}

                {/* Assignees */}
                {(() => {
                  // Show approved user if completed, otherwise all claimants
                  const claimants = approvedSubmission
                    ? [approvedSubmission.user]
                    : bounty.claims.map((c) => c.user).slice(0, 3)

                  // Single or zero assignees: show inline
                  if (claimants.length <= 1) {
                    return (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-xs text-muted-foreground">
                          Assignee
                        </span>
                        {claimants.length === 0 ? (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <div className="flex size-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/30">
                              <User01 className="size-2.5" />
                            </div>
                            <span className="text-xs">Unassigned</span>
                          </div>
                        ) : (
                          <Link
                            href={routes.user.profile({
                              username:
                                claimants[0].username ?? claimants[0].id,
                            })}
                            className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted"
                          >
                            <Avatar className="size-5">
                              <AvatarImage
                                src={claimants[0].image ?? undefined}
                              />
                              <AvatarFallback className="text-[9px]">
                                {claimants[0].name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs">{claimants[0].name}</span>
                          </Link>
                        )}
                      </div>
                    )
                  }

                  // Multiple assignees: show on separate line
                  return (
                    <div className="space-y-2 py-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Assignees
                        </span>
                        {bounty.claims.length > 3 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                              >
                                View all ({bounty.claims.length})
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-2" align="end">
                              <div className="space-y-1">
                                <div className="mb-2 text-xs font-medium text-muted-foreground">
                                  All Claimants
                                </div>
                                <div className="max-h-64 space-y-1 overflow-y-auto">
                                  {bounty.claims.map((claim) => (
                                    <Link
                                      key={claim.id}
                                      href={routes.user.profile({
                                        username:
                                          claim.user.username ?? claim.user.id,
                                      })}
                                      className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
                                    >
                                      <Avatar className="size-6">
                                        <AvatarImage
                                          src={claim.user.image ?? undefined}
                                        />
                                        <AvatarFallback className="text-[10px]">
                                          {claim.user.name.charAt(0)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate text-xs font-medium">
                                          {claim.user.name}
                                        </div>
                                        {claim.user.username && (
                                          <div className="truncate text-[10px] text-muted-foreground">
                                            @{claim.user.username}
                                          </div>
                                        )}
                                      </div>
                                      {claim.status === ClaimStatus.ACTIVE && (
                                        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                          Active
                                        </span>
                                      )}
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {claimants.map((user) => (
                          <Link
                            key={user.id}
                            href={routes.user.profile({
                              username: user.username ?? user.id,
                            })}
                            className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted"
                          >
                            <Avatar className="size-5">
                              <AvatarImage src={user.image ?? undefined} />
                              <AvatarFallback className="text-[9px]">
                                {user.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs">{user.name}</span>
                          </Link>
                        ))}
                        {bounty.claims.length > 3 && !approvedSubmission && (
                          <span className="flex items-center text-xs text-muted-foreground">
                            +{bounty.claims.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Labels */}
                <div className="space-y-2 py-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Labels
                    </span>
                    {isFounder && (
                      <Popover
                        open={showLabelPicker}
                        onOpenChange={setShowLabelPicker}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="end">
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">
                              Select labels
                            </div>
                            <div className="max-h-48 space-y-1 overflow-y-auto">
                              {(projectLabels ?? []).map((label) => {
                                const color = getLabelColor(label.color)
                                const isSelected = bounty.labels.some(
                                  (l) => l.label.id === label.id,
                                )
                                return (
                                  <button
                                    key={label.id}
                                    type="button"
                                    onClick={() => {
                                      const currentIds = bounty.labels.map(
                                        (l) => l.label.id,
                                      )
                                      const newIds = isSelected
                                        ? currentIds.filter(
                                            (id) => id !== label.id,
                                          )
                                        : [...currentIds, label.id]
                                      updateBountyLabels.mutate({
                                        id: bounty.id,
                                        labelIds: newIds,
                                      })
                                    }}
                                    className={cn(
                                      'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted',
                                      isSelected && 'bg-muted',
                                    )}
                                  >
                                    <span
                                      className="size-2.5 shrink-0 rounded-full"
                                      style={{ backgroundColor: color.dot }}
                                    />
                                    <span className="flex-1 truncate">
                                      {label.name}
                                    </span>
                                    {isSelected && (
                                      <Check className="size-3.5 text-primary" />
                                    )}
                                  </button>
                                )
                              })}
                              {(projectLabels ?? []).length === 0 && (
                                <p className="px-2 py-1 text-xs text-muted-foreground">
                                  No labels yet
                                </p>
                              )}
                            </div>
                            <Separator />
                            {showCreateLabel ? (
                              <div className="space-y-2 pt-1">
                                <input
                                  type="text"
                                  value={newLabelName}
                                  onChange={(e) =>
                                    setNewLabelName(e.target.value)
                                  }
                                  placeholder="Label name"
                                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (
                                      e.key === 'Enter' &&
                                      newLabelName.trim()
                                    ) {
                                      e.preventDefault()
                                      createLabel.mutate({
                                        projectId: bounty.project.id,
                                        name: newLabelName.trim(),
                                        color: newLabelColor,
                                      })
                                    }
                                    if (e.key === 'Escape') {
                                      setShowCreateLabel(false)
                                      setNewLabelName('')
                                    }
                                  }}
                                />
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setNewLabelColor(
                                        generateRandomLabelColor(),
                                      )
                                    }
                                    className="flex size-6 cursor-pointer items-center justify-center rounded-sm border border-border transition-colors hover:bg-muted"
                                    style={{
                                      backgroundColor: `${newLabelColor}30`,
                                    }}
                                  >
                                    <RefreshCcw01
                                      className="size-3"
                                      style={{ color: newLabelColor }}
                                    />
                                  </button>
                                  <input
                                    type="text"
                                    value={newLabelColor.replace('#', '')}
                                    onChange={(e) => {
                                      const value = e.target.value.replace(
                                        /[^0-9A-Fa-f]/g,
                                        '',
                                      )
                                      if (value.length <= 6) {
                                        setNewLabelColor(`#${value}`)
                                      }
                                    }}
                                    className="w-full flex-1 rounded-sm border border-border bg-background px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                                    placeholder="d73a4a"
                                    maxLength={6}
                                  />
                                </div>
                                <div className="flex gap-1">
                                  <AppButton
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 flex-1 cursor-pointer text-xs"
                                    onClick={() => {
                                      setShowCreateLabel(false)
                                      setNewLabelName('')
                                    }}
                                  >
                                    Cancel
                                  </AppButton>
                                  <AppButton
                                    size="sm"
                                    className="h-6 flex-1 cursor-pointer text-xs"
                                    disabled={
                                      !newLabelName.trim() ||
                                      newLabelColor.length !== 7 ||
                                      createLabel.isPending
                                    }
                                    onClick={() => {
                                      createLabel.mutate({
                                        projectId: bounty.project.id,
                                        name: newLabelName.trim(),
                                        color: newLabelColor,
                                      })
                                    }}
                                  >
                                    {createLabel.isPending ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      'Create'
                                    )}
                                  </AppButton>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowCreateLabel(true)
                                  setNewLabelColor(generateRandomLabelColor())
                                }}
                                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <Plus className="size-3.5" />
                                Create new label
                              </button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  {bounty.labels.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {bounty.labels.map(({ label }) => {
                        const color = getLabelColor(label.color)
                        return (
                          <Badge
                            key={label.id}
                            variant="outline"
                            className="text-[10px]"
                          >
                            <span
                              className="mr-1 size-1.5 rounded-full"
                              style={{ backgroundColor: color.dot }}
                            />
                            {label.name}
                          </Badge>
                        )
                      })}
                    </div>
                  ) : null}
                </div>

                {/* Claim mode */}
                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users01 className="size-3 text-foreground opacity-50" />
                    Claim Type
                  </span>
                  <span className="text-xs">
                    {
                      getClaimModeInfo(bounty.claimMode as BountyClaimMode)
                        .label
                    }
                  </span>
                </div>

                {/* Claim type info */}
                <div className="rounded-md bg-primary/5 px-3 py-2 text-right text-xs text-muted-foreground/70">
                  {
                    getClaimModeInfo(bounty.claimMode as BountyClaimMode)
                      .contributorHint
                  }
                </div>

                {/* Claim expiry */}
                <div className="flex items-center justify-between py-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex cursor-help items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3 text-foreground opacity-50" />
                        Deadline
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Once you claim this bounty, you have this many days to
                      complete and submit your work.
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-xs" suppressHydrationWarning>
                    {userClaim && new Date(userClaim.expiresAt) < new Date() ? (
                      <span className="text-destructive">Expired</span>
                    ) : (
                      <>
                        {bounty.claimExpiryDays} day
                        {bounty.claimExpiryDays !== 1 ? 's' : ''}
                      </>
                    )}
                  </span>
                </div>

                {/* Profit share ends */}
                {commitmentDate && (
                  <div className="flex items-center justify-between py-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex cursor-help items-center gap-1 text-xs text-muted-foreground">
                          <Target01 className="size-3 text-foreground opacity-50" />
                          Profit Share Ends
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {isForeverCommitment
                          ? 'The founder has committed to paying contributors indefinitely.'
                          : 'The founder has committed to paying contributors until this date.'}
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-xs" suppressHydrationWarning>
                      {isForeverCommitment ? (
                        'Never'
                      ) : new Date(commitmentDate) < new Date() ? (
                        <span className="text-destructive">Expired</span>
                      ) : (
                        new Date(commitmentDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Profit share warning */}
              {bounty.project.rewardPool &&
                commitmentRemaining !== null &&
                commitmentRemaining < 90 && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                    <div className="flex gap-2">
                      <AlertCircle className="size-4 shrink-0 text-amber-500" />
                      <div className="text-xs text-amber-700 dark:text-amber-400">
                        <p className="font-medium">
                          Profit share commitment ending soon
                        </p>
                        <p className="mt-0.5 opacity-80">
                          Ends in {commitmentRemaining} days
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

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
        isLoading={isClaiming}
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

      {/* Close bounty modal */}
      <ConfirmModal
        open={showCloseModal}
        onClose={() => {
          setShowCloseModal(false)
          setCloseReason('')
        }}
        onConfirm={() => {
          closeBounty.mutate({
            bountyId: bounty.id,
            reason: closeReason.trim() || undefined,
          })
        }}
        title="Close this bounty?"
        description={
          bounty.status === BountyStatus.CLAIMED
            ? 'This bounty is currently being worked on. Closing it will expire all active claims and withdraw pending submissions.'
            : 'This bounty will no longer be claimable. You can reopen it later if needed.'
        }
        content={
          <textarea
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder="Reason for closing (optional)"
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
            rows={3}
          />
        }
        confirmText="Close Bounty"
        cancelText="Cancel"
        variant="destructive"
        isLoading={closeBounty.isPending}
      />

      {/* Submit work modal */}
      <SubmissionModal
        open={showSubmissionModal}
        onOpenChange={setShowSubmissionModal}
        mode="create"
        bountyId={bounty.id}
      />

      {/* Reject suggestion modal */}
      <ConfirmModal
        open={showRejectModal}
        onClose={() => {
          setShowRejectModal(false)
          setRejectReason('')
        }}
        onConfirm={() => {
          rejectSuggestion.mutate(
            {
              bountyId: bounty.id,
              reason: rejectReason.trim() || undefined,
            },
            {
              onSuccess: () => {
                setShowRejectModal(false)
                setRejectReason('')
              },
            },
          )
        }}
        title="Reject this suggestion?"
        description="The contributor will be notified that their suggestion was not accepted."
        content={
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Feedback for the contributor (optional)"
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
            rows={3}
          />
        }
        confirmText="Reject Suggestion"
        cancelText="Cancel"
        variant="destructive"
        isLoading={rejectSuggestion.isPending}
      />
    </AppBackground>
  )
}
