'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  Copy01,
  Target01,
  Users01,
} from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { notFound } from 'next/navigation'
import { BountyClaimMode, BountyStatus, ClaimStatus } from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import {
  AppButton,
  AppCard,
  AppCardContent,
  AppCardDescription,
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
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'

const tagColors: Record<string, string> = {
  GROWTH: 'border-green-500/20 bg-green-500/10 text-green-500',
  SALES: 'border-blue-500/20 bg-blue-500/10 text-blue-500',
  CONTENT: 'border-purple-500/20 bg-purple-500/10 text-purple-500',
  DESIGN: 'border-pink-500/20 bg-pink-500/10 text-pink-500',
  DEV: 'border-orange-500/20 bg-orange-500/10 text-orange-500',
}

export default function BountyDetailPage() {
  const router = useRouter()
  const params = useParams<{ slug: string; bountyId: string }>()
  const { data: session } = useSession()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [submissionDescription, setSubmissionDescription] = useState('')
  const [copied, setCopied] = useState(false)
  const [showReleaseModal, setShowReleaseModal] = useState(false)

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

  if (isLoading) {
    return (
      <AppBackground>
        <div className="container max-w-3xl px-4 py-8">
          <Skeleton className="mb-4 h-6 w-32" />
          <Skeleton className="mb-8 h-10 w-3/4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppBackground>
    )
  }

  if (!bounty) {
    notFound()
  }

  const userClaim = bounty.claims.find((c) => c.userId === session?.user?.id)
  const hasActiveClaim = userClaim?.status === ClaimStatus.ACTIVE
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
      await releaseClaim.mutateAsync({ claimId: userClaim.id })
      setShowReleaseModal(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!submissionDescription.trim()) return

    setIsSubmitting(true)
    try {
      await createSubmission.mutateAsync({
        bountyId: bounty.id,
        description: submissionDescription,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const commitmentDate = bounty.project.rewardPool?.commitmentEndsAt
  const commitmentRemaining = commitmentDate
    ? Math.ceil(
        (new Date(commitmentDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null

  const bountyUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/p/${params.slug}/bounty/${params.bountyId}`
      : ''

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(bountyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AppBackground>
      <div className="container max-w-4xl px-4 py-8">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={routes.project.detail({ slug: params.slug })}>
                  {bounty.project.name}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Bounties</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {bounty.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className={cn(
                  'text-xs',
                  tagColors[tag] ||
                    'border-border bg-muted text-muted-foreground',
                )}
              >
                {tag.toLowerCase()}
              </Badge>
            ))}
            {bounty.status !== BountyStatus.OPEN && (
              <Badge
                variant={
                  bounty.status === BountyStatus.COMPLETED
                    ? 'default'
                    : 'secondary'
                }
              >
                {bounty.status.toLowerCase()}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {bounty.title}
          </h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Description */}
            <AppCard>
              <AppCardHeader>
                <AppCardTitle>Description</AppCardTitle>
              </AppCardHeader>
              <AppCardContent>
                <div className="max-w-none text-sm whitespace-pre-wrap text-muted-foreground">
                  {bounty.description}
                </div>
              </AppCardContent>
            </AppCard>

            {/* Evidence Requirements */}
            {bounty.evidenceDescription && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                <div className="flex gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                    <AlertTriangle className="size-4 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-amber-700 dark:text-amber-400">
                      Evidence Required
                    </h3>
                    <p className="mt-2 text-sm text-amber-700/80 dark:text-amber-400/80">
                      {bounty.evidenceDescription}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Work Form */}
            {hasActiveClaim && (
              <AppCard>
                <AppCardHeader>
                  <AppCardTitle>Submit Your Work</AppCardTitle>
                  <AppCardDescription>
                    Describe what you&apos;ve done and provide evidence
                  </AppCardDescription>
                </AppCardHeader>
                <AppCardContent>
                  {showSubmitForm ? (
                    <form onSubmit={handleSubmitWork} className="space-y-4">
                      <AppTextarea
                        value={submissionDescription}
                        onChange={(e) =>
                          setSubmissionDescription(e.target.value)
                        }
                        placeholder="Describe your work and include any links, screenshots, or evidence..."
                        rows={6}
                        required
                        disabled={isSubmitting}
                      />
                      <div className="flex justify-end gap-2">
                        <AppButton
                          type="button"
                          variant="outline"
                          onClick={() => setShowSubmitForm(false)}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </AppButton>
                        <AppButton
                          type="submit"
                          disabled={
                            isSubmitting || !submissionDescription.trim()
                          }
                        >
                          {isSubmitting && (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                          )}
                          Submit Work
                        </AppButton>
                      </div>
                    </form>
                  ) : (
                    <AppButton
                      onClick={() => setShowSubmitForm(true)}
                      className="w-full"
                    >
                      <Check className="mr-2 size-4" />
                      Submit Work for Review
                    </AppButton>
                  )}
                </AppCardContent>
              </AppCard>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Points Badge */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
                  <p className="text-4xl font-bold text-primary">
                    +{bounty.points}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    points reward
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Points determine your share of the reward pool. More points =
                bigger cut of each payout.
              </TooltipContent>
            </Tooltip>

            {/* Action */}
            {!session ? (
              <div className="space-y-3">
                <AppButton asChild className="w-full" size="lg">
                  <Link href={routes.auth.signIn()}>Sign In to Claim</Link>
                </AppButton>
                <p className="text-center text-xs text-muted-foreground">
                  Sign in to claim this bounty
                </p>
              </div>
            ) : hasActiveClaim ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-center">
                  <Check className="mx-auto mb-2 size-5 text-green-500" />
                  <p className="text-sm font-medium text-green-500">
                    You&apos;ve claimed this bounty
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Expires {new Date(userClaim.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <AppButton
                  variant="outline"
                  onClick={() => setShowReleaseModal(true)}
                  className="w-full"
                >
                  Release Claim
                </AppButton>
              </div>
            ) : canClaim ? (
              <AppButton
                onClick={handleClaim}
                disabled={isSubmitting}
                className="w-full"
                size="lg"
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                <Target01 className="mr-2 size-4" />
                Claim This Bounty
              </AppButton>
            ) : bounty.status === BountyStatus.CLAIMED ? (
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-center">
                <Clock className="mx-auto mb-2 size-5 text-yellow-500" />
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  This bounty is currently claimed
                </p>
              </div>
            ) : bounty.status === BountyStatus.COMPLETED ? (
              <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-center">
                <Check className="mx-auto mb-2 size-5 text-green-500" />
                <p className="text-sm text-green-700 dark:text-green-400">
                  This bounty has been completed
                </p>
              </div>
            ) : userClaim ? (
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                Your claim has expired or been completed
              </div>
            ) : null}

            {/* Share Link */}
            <button
              onClick={handleCopyLink}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
            >
              <span className="text-muted-foreground">
                {copied ? 'Copied!' : 'Share this bounty'}
              </span>
              <Copy01
                className={cn(
                  'size-4',
                  copied ? 'text-green-500' : 'text-muted-foreground',
                )}
              />
            </button>

            {/* Details */}
            <AppCard>
              <AppCardHeader className="pb-3">
                <AppCardTitle className="text-sm font-medium">
                  Bounty Details
                </AppCardTitle>
              </AppCardHeader>
              <AppCardContent className="pt-0">
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between py-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex cursor-help items-center gap-2 text-sm text-muted-foreground">
                          <Users01 className="size-4" />
                          Claim Mode
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {bounty.claimMode === BountyClaimMode.SINGLE
                          ? 'Only one person can work on this bounty at a time.'
                          : 'Multiple people can work on this bounty simultaneously.'}
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-sm font-medium">
                      {bounty.claimMode === BountyClaimMode.SINGLE
                        ? 'Single'
                        : 'Multiple'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex cursor-help items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="size-4" />
                          Expires in
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Once you claim this bounty, you have this many days to
                        complete and submit your work.
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-sm font-medium">
                      {bounty.claimExpiryDays} day
                      {bounty.claimExpiryDays !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="size-4" />
                      Created
                    </span>
                    <span className="text-sm font-medium">
                      {new Date(bounty.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {commitmentDate && (
                    <div className="flex items-center justify-between py-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex cursor-help items-center gap-2 text-sm text-muted-foreground">
                            <Target01 className="size-4" />
                            Pool Ends
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          The founder has committed to paying contributors until
                          this date. Points earned before this date remain
                          valid.
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-sm font-medium">
                        {new Date(commitmentDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </AppCardContent>
            </AppCard>

            {/* Current Claims */}
            {bounty.claims.length > 0 && (
              <AppCard>
                <AppCardHeader className="pb-3">
                  <AppCardTitle className="text-sm font-medium">
                    Active Claims ({bounty.claims.length})
                  </AppCardTitle>
                </AppCardHeader>
                <AppCardContent className="pt-0">
                  <div className="space-y-3">
                    {bounty.claims.map((claim) => (
                      <div key={claim.id} className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarImage src={claim.user.image ?? undefined} />
                          <AvatarFallback>
                            {claim.user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {claim.user.name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </AppCardContent>
              </AppCard>
            )}

            {/* Pool Info Warning */}
            {bounty.project.rewardPool &&
              commitmentRemaining !== null &&
              commitmentRemaining < 90 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="size-5 shrink-0 text-amber-500" />
                    <div className="text-sm text-amber-700 dark:text-amber-400">
                      <p className="font-medium">Pool commitment ending soon</p>
                      <p className="mt-1 text-xs opacity-80">
                        Ends in {commitmentRemaining} days. Points earned before
                        then are still valid.
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showReleaseModal}
        onClose={() => setShowReleaseModal(false)}
        onConfirm={handleReleaseClaim}
        title="Release this claim?"
        description="This will free up the bounty for others to claim. Any work you've done won't be lost, but you'll need to claim it again to submit."
        confirmText="Release Claim"
        cancelText="Keep Claim"
        variant="destructive"
        isLoading={isSubmitting}
      />
    </AppBackground>
  )
}
