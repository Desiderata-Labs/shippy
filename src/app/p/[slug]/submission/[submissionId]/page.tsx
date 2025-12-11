'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  Check,
  Clock,
  MessageTextSquare02,
  Send01,
  Target01,
  X,
} from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { notFound } from 'next/navigation'
import { SubmissionStatus } from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import {
  AppButton,
  AppCard,
  AppCardContent,
  AppCardHeader,
  AppCardTitle,
  AppTextarea,
} from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof Check }
> = {
  [SubmissionStatus.DRAFT]: {
    label: 'Draft',
    color: 'bg-muted text-muted-foreground border-muted',
    icon: Clock,
  },
  [SubmissionStatus.PENDING]: {
    label: 'Pending Review',
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    icon: Clock,
  },
  [SubmissionStatus.NEEDS_INFO]: {
    label: 'Needs Info',
    color: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    icon: MessageTextSquare02,
  },
  [SubmissionStatus.APPROVED]: {
    label: 'Approved',
    color: 'bg-green-500/10 text-green-500 border-green-500/20',
    icon: Check,
  },
  [SubmissionStatus.REJECTED]: {
    label: 'Rejected',
    color: 'bg-red-500/10 text-red-500 border-red-500/20',
    icon: X,
  },
}

export default function SubmissionDetailPage() {
  const params = useParams<{ slug: string; submissionId: string }>()
  const { data: session } = useSession()
  const [messageContent, setMessageContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const [showReviewActions, setShowReviewActions] = useState(false)

  const { data: submission, isLoading } = trpc.submission.getById.useQuery(
    { id: params.submissionId },
    { enabled: !!params.submissionId },
  )

  const utils = trpc.useUtils()

  const addMessage = trpc.submission.addMessage.useMutation({
    onSuccess: () => {
      setMessageContent('')
      utils.submission.getById.invalidate({ id: params.submissionId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const reviewSubmission = trpc.submission.review.useMutation({
    onSuccess: () => {
      toast.success('Submission reviewed')
      setShowReviewActions(false)
      setReviewNote('')
      utils.submission.getById.invalidate({ id: params.submissionId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  if (isLoading) {
    return (
      <AppBackground>
        <div className="container max-w-3xl px-4 py-8">
          <Skeleton className="mb-4 h-6 w-32" />
          <Skeleton className="mb-8 h-10 w-3/4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppBackground>
    )
  }

  if (!submission) {
    notFound()
  }

  const isFounder = session?.user?.id === submission.bounty.project.founderId
  const isSubmitter = session?.user?.id === submission.userId
  const canReview =
    isFounder &&
    submission.status !== SubmissionStatus.APPROVED &&
    submission.status !== SubmissionStatus.REJECTED

  const status =
    statusConfig[submission.status] || statusConfig[SubmissionStatus.PENDING]
  const StatusIcon = status.icon

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageContent.trim()) return

    setIsSending(true)
    try {
      await addMessage.mutateAsync({
        submissionId: submission.id,
        content: messageContent,
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleReview = async (action: 'approve' | 'reject' | 'requestInfo') => {
    setIsSending(true)
    try {
      await reviewSubmission.mutateAsync({
        id: submission.id,
        action,
        note: reviewNote || undefined,
        pointsAwarded:
          action === 'approve' ? submission.bounty.points : undefined,
      })
    } finally {
      setIsSending(false)
    }
  }

  // Combine initial description with messages for timeline
  const timeline = [
    {
      id: 'initial',
      user: submission.user,
      content: submission.description,
      createdAt: submission.createdAt,
      isInitial: true,
    },
    ...submission.messages.map((m) => ({
      id: m.id,
      user: m.user,
      content: m.content,
      createdAt: m.createdAt,
      isInitial: false,
    })),
  ]

  return (
    <AppBackground>
      <div className="container max-w-3xl px-4 py-8">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={routes.project.detail({ slug: params.slug })}>
                  {submission.bounty.project.name}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  href={routes.project.bountyDetail({
                    slug: params.slug,
                    bountyId: submission.bountyId,
                  })}
                >
                  Bounty
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Submission</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className={cn('gap-1.5', status.color)}>
              <StatusIcon className="size-3" />
              {status.label}
            </Badge>
            {submission.pointsAwarded && (
              <Badge className="border-green-500/20 bg-green-500/10 text-green-500">
                +{submission.pointsAwarded} points awarded
              </Badge>
            )}
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            {submission.bounty.title}
          </h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="size-5">
                <AvatarImage src={submission.user.image ?? undefined} />
                <AvatarFallback className="text-xs">
                  {submission.user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span>{submission.user.name}</span>
            </div>
            <span>•</span>
            <span>
              {new Date(submission.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Conversation Thread */}
        <AppCard className="mb-6">
          <AppCardHeader>
            <AppCardTitle className="flex items-center gap-2">
              <MessageTextSquare02 className="size-4" />
              Conversation
            </AppCardTitle>
          </AppCardHeader>
          <AppCardContent className="p-0">
            <div className="divide-y divide-border">
              {timeline.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex gap-3">
                    <Avatar className="size-8 shrink-0">
                      <AvatarImage src={item.user.image ?? undefined} />
                      <AvatarFallback>
                        {item.user.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.user.name}</span>
                        {item.user.id ===
                          submission.bounty.project.founderId && (
                          <Badge
                            variant="outline"
                            className="px-1.5 py-0 text-[10px]"
                          >
                            Founder
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString(
                            'en-US',
                            {
                              month: 'short',
                              day: 'numeric',
                            },
                          )}{' '}
                          at{' '}
                          {new Date(item.createdAt).toLocaleTimeString(
                            'en-US',
                            {
                              hour: 'numeric',
                              minute: '2-digit',
                            },
                          )}
                        </span>
                      </div>
                      <div className="mt-2 text-sm whitespace-pre-wrap">
                        {item.content}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add message form */}
            {submission.status !== SubmissionStatus.APPROVED &&
              submission.status !== SubmissionStatus.REJECTED && (
                <form
                  onSubmit={handleSendMessage}
                  className="border-t border-border p-4"
                >
                  <div className="flex gap-3">
                    <Avatar className="size-8 shrink-0">
                      <AvatarImage src={session?.user?.image ?? undefined} />
                      <AvatarFallback>
                        {session?.user?.name?.charAt(0) ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <AppTextarea
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value)}
                        placeholder="Add a comment..."
                        rows={3}
                        disabled={isSending}
                      />
                      <div className="mt-2 flex justify-end">
                        <AppButton
                          type="submit"
                          size="sm"
                          disabled={isSending || !messageContent.trim()}
                        >
                          {isSending ? (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                          ) : (
                            <Send01 className="mr-2 size-4" />
                          )}
                          Send
                        </AppButton>
                      </div>
                    </div>
                  </div>
                </form>
              )}
          </AppCardContent>
        </AppCard>

        {/* Review Actions (Founder only) */}
        {canReview && (
          <AppCard>
            <AppCardHeader>
              <AppCardTitle className="flex items-center gap-2">
                <Target01 className="size-4" />
                Review Submission
              </AppCardTitle>
            </AppCardHeader>
            <AppCardContent>
              {showReviewActions ? (
                <div className="space-y-4">
                  <AppTextarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Add a note (optional)..."
                    rows={3}
                    disabled={isSending}
                  />
                  <div className="flex flex-wrap gap-2">
                    <AppButton
                      onClick={() => handleReview('approve')}
                      disabled={isSending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isSending ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 size-4" />
                      )}
                      Approve (+{submission.bounty.points} pts)
                    </AppButton>
                    <AppButton
                      variant="outline"
                      onClick={() => handleReview('requestInfo')}
                      disabled={isSending}
                    >
                      <MessageTextSquare02 className="mr-2 size-4" />
                      Request Info
                    </AppButton>
                    <AppButton
                      variant="outline"
                      onClick={() => handleReview('reject')}
                      disabled={isSending}
                      className="text-red-500 hover:bg-red-500/10 hover:text-red-500"
                    >
                      <X className="mr-2 size-4" />
                      Reject
                    </AppButton>
                    <AppButton
                      variant="ghost"
                      onClick={() => setShowReviewActions(false)}
                      disabled={isSending}
                    >
                      Cancel
                    </AppButton>
                  </div>
                </div>
              ) : (
                <AppButton
                  onClick={() => setShowReviewActions(true)}
                  className="w-full"
                >
                  Review This Submission
                </AppButton>
              )}
            </AppCardContent>
          </AppCard>
        )}

        {/* Rejection Note */}
        {submission.status === SubmissionStatus.REJECTED &&
          submission.rejectionNote && (
            <AppCard className="border-red-500/20 bg-red-500/5">
              <AppCardHeader>
                <AppCardTitle className="flex items-center gap-2 text-red-500">
                  <X className="size-4" />
                  Rejection Reason
                </AppCardTitle>
              </AppCardHeader>
              <AppCardContent>
                <p className="text-sm">{submission.rejectionNote}</p>
              </AppCardContent>
            </AppCard>
          )}

        {/* Approval Info */}
        {submission.status === SubmissionStatus.APPROVED && (
          <AppCard className="border-green-500/20 bg-green-500/5">
            <AppCardHeader>
              <AppCardTitle className="flex items-center gap-2 text-green-500">
                <Check className="size-4" />
                Submission Approved
              </AppCardTitle>
            </AppCardHeader>
            <AppCardContent>
              <p className="text-sm">
                {submission.pointsAwarded} points have been awarded to{' '}
                {isSubmitter ? 'you' : submission.user.name}.
              </p>
              {submission.approvedAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Approved on{' '}
                  {new Date(submission.approvedAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              )}
            </AppCardContent>
          </AppCard>
        )}
      </div>
    </AppBackground>
  )
}
