'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  Calendar,
  Check,
  Clock,
  CoinsStacked01,
  Plus,
  Send01,
  X,
} from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { redirect } from 'next/navigation'
import { PayoutRecipientStatus, PayoutStatus } from '@/lib/db/types'
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
import { ErrorState } from '@/components/ui/error-state'
import { NotFoundState } from '@/components/ui/not-found-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

const statusConfig: Record<string, { label: string; color: string }> = {
  [PayoutStatus.ANNOUNCED]: {
    label: 'Pending payment',
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  },
  [PayoutStatus.SENT]: {
    label: 'Paid',
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  [PayoutStatus.COMPLETED]: {
    label: 'Completed',
    color: 'bg-green-500/10 text-green-500 border-green-500/20',
  },
}

const recipientStatusConfig: Record<
  string,
  { label: string; color: string; icon: typeof Check }
> = {
  [PayoutRecipientStatus.PENDING]: {
    label: 'Pending payment',
    color: 'text-yellow-500',
    icon: Clock,
  },
  [PayoutRecipientStatus.CONFIRMED]: {
    label: 'Confirmed',
    color: 'text-green-500',
    icon: Check,
  },
  [PayoutRecipientStatus.DISPUTED]: {
    label: 'Disputed',
    color: 'text-red-500',
    icon: X,
  },
  [PayoutRecipientStatus.UNCONFIRMED]: {
    label: 'Unconfirmed',
    color: 'text-muted-foreground',
    icon: Clock,
  },
}

export default function PayoutsPage() {
  const params = useParams<{ slug: string }>()
  const { data: session, isPending: sessionLoading } = useSession()
  const [markingSentId, setMarkingSentId] = useState<string | null>(null)
  const [sentNote, setSentNote] = useState('')
  const [showSentForm, setShowSentForm] = useState<string | null>(null)

  // Fetch project data
  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
    error: projectErrorData,
    refetch: refetchProject,
  } = trpc.project.getBySlug.useQuery(
    { slug: params.slug },
    { enabled: !!params.slug, retry: false },
  )

  // Fetch payouts
  const { data: payouts, isLoading: payoutsLoading } =
    trpc.payout.getByProject.useQuery(
      { projectId: project?.id ?? '' },
      { enabled: !!project?.id },
    )

  const utils = trpc.useUtils()

  const markSent = trpc.payout.markSent.useMutation({
    onSuccess: () => {
      toast.success('Payout marked as sent')
      setShowSentForm(null)
      setSentNote('')
      utils.payout.getByProject.invalidate({ projectId: project?.id })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Loading states
  if (sessionLoading || projectLoading) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Skeleton className="mb-4 h-6 w-32" />
          <Skeleton className="mb-8 h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppBackground>
    )
  }

  // Auth check
  if (!session) {
    redirect(routes.auth.signIn())
  }

  // Handle errors - differentiate between 404/forbidden and other errors
  if (projectError) {
    const isNotFoundOrForbidden =
      projectErrorData?.data?.code === 'NOT_FOUND' ||
      projectErrorData?.data?.code === 'FORBIDDEN' ||
      projectErrorData?.data?.code === 'BAD_REQUEST'
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl px-4 py-8">
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

  // Project not found or user is not the founder
  if (!project || project.founderId !== session.user.id) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl px-4 py-8">
          <NotFoundState
            resourceType="project"
            backHref={routes.dashboard.root()}
            backLabel="Back to Dashboard"
          />
        </div>
      </AppBackground>
    )
  }

  const handleMarkSent = async (payoutId: string) => {
    setMarkingSentId(payoutId)
    try {
      await markSent.mutateAsync({
        payoutId,
        note: sentNote || undefined,
      })
    } finally {
      setMarkingSentId(null)
    }
  }

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={routes.project.detail({ slug: params.slug })}>
                  {project.name}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Payouts</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payouts</h1>
            <p className="mt-2 text-muted-foreground">
              Manage reward pool distributions
            </p>
          </div>
          <AppButton asChild>
            <Link href={routes.project.newPayout({ slug: params.slug })}>
              <Plus className="mr-2 size-4" />
              New Payout
            </Link>
          </AppButton>
        </div>

        {payoutsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : !payouts || payouts.length === 0 ? (
          <AppCard>
            <AppCardContent className="py-12 text-center">
              <div className="mx-auto flex max-w-xs flex-col items-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                  <CoinsStacked01 className="size-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold">No payouts yet</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Create your first payout to distribute the reward pool.
                </p>
                <AppButton asChild className="mt-4">
                  <Link href={routes.project.newPayout({ slug: params.slug })}>
                    <Plus className="mr-2 size-4" />
                    Create Payout
                  </Link>
                </AppButton>
              </div>
            </AppCardContent>
          </AppCard>
        ) : (
          <div className="space-y-6">
            {payouts.map((payout) => {
              const status =
                statusConfig[payout.status] ||
                statusConfig[PayoutStatus.ANNOUNCED]
              const confirmedCount = payout.recipients.filter(
                (r) => r.status === PayoutRecipientStatus.CONFIRMED,
              ).length
              const disputedCount = payout.recipients.filter(
                (r) => r.status === PayoutRecipientStatus.DISPUTED,
              ).length

              return (
                <AppCard key={payout.id}>
                  <AppCardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <AppCardTitle className="flex items-center gap-2">
                            <Calendar className="size-4" />
                            {payout.periodLabel}
                          </AppCardTitle>
                          <Badge
                            variant="outline"
                            className={cn('text-xs', status.color)}
                          >
                            {status.label}
                          </Badge>
                        </div>
                        <AppCardDescription className="mt-1">
                          {new Date(payout.periodStart).toLocaleDateString()} -{' '}
                          {new Date(payout.periodEnd).toLocaleDateString()}
                        </AppCardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">
                          {formatCurrency(payout.poolAmountCents)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          from {formatCurrency(payout.reportedProfitCents)}{' '}
                          profit
                        </p>
                      </div>
                    </div>
                  </AppCardHeader>
                  <AppCardContent>
                    {/* Recipients */}
                    <div className="mb-4 space-y-2">
                      {payout.recipients.map((recipient) => {
                        const recipientStatus =
                          recipientStatusConfig[recipient.status] ||
                          recipientStatusConfig[PayoutRecipientStatus.PENDING]
                        const StatusIcon = recipientStatus.icon

                        return (
                          <div
                            key={recipient.id}
                            className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="size-8">
                                <AvatarImage
                                  src={recipient.user.image ?? undefined}
                                />
                                <AvatarFallback>
                                  {recipient.user.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {recipient.user.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {recipient.pointsAtPayout} pts (
                                  {parseFloat(
                                    recipient.sharePercent.toString(),
                                  ).toFixed(1)}
                                  %)
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold">
                                {formatCurrency(recipient.amountCents)}
                              </span>
                              <StatusIcon
                                className={cn('size-4', recipientStatus.color)}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Confirmation stats */}
                    <div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Check className="size-3 text-green-500" />
                        {confirmedCount} confirmed
                      </span>
                      {disputedCount > 0 && (
                        <span className="flex items-center gap-1 text-red-500">
                          <X className="size-3" />
                          {disputedCount} disputed
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    {payout.status === PayoutStatus.ANNOUNCED && (
                      <>
                        {showSentForm === payout.id ? (
                          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                            <p className="text-sm font-medium">Mark as Paid</p>
                            <AppTextarea
                              value={sentNote}
                              onChange={(e) => setSentNote(e.target.value)}
                              placeholder="Optional: Add payment reference (e.g., PayPal txn #12345)"
                              rows={2}
                              disabled={markingSentId === payout.id}
                            />
                            <div className="flex justify-end gap-2">
                              <AppButton
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setShowSentForm(null)
                                  setSentNote('')
                                }}
                                disabled={markingSentId === payout.id}
                              >
                                Cancel
                              </AppButton>
                              <AppButton
                                size="sm"
                                onClick={() => handleMarkSent(payout.id)}
                                disabled={markingSentId === payout.id}
                              >
                                {markingSentId === payout.id ? (
                                  <Loader2 className="mr-2 size-4 animate-spin" />
                                ) : (
                                  <Send01 className="mr-2 size-4" />
                                )}
                                Confirm Paid
                              </AppButton>
                            </div>
                          </div>
                        ) : (
                          <AppButton
                            onClick={() => setShowSentForm(payout.id)}
                            className="w-full"
                          >
                            <Send01 className="mr-2 size-4" />
                            Mark as Paid
                          </AppButton>
                        )}
                      </>
                    )}

                    {payout.status === PayoutStatus.SENT && payout.sentNote && (
                      <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                        <p className="text-xs text-blue-700 dark:text-blue-400">
                          <span className="font-medium">Payment note:</span>{' '}
                          {payout.sentNote}
                        </p>
                        {payout.sentAt && (
                          <p className="mt-1 text-xs text-blue-700/70 dark:text-blue-400/70">
                            Sent on{' '}
                            {new Date(payout.sentAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </AppCardContent>
                </AppCard>
              )
            })}
          </div>
        )}
      </div>
    </AppBackground>
  )
}
