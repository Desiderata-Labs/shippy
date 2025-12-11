'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  AlertCircle,
  ArrowUp,
  Calendar,
  Check,
  Clock,
  CoinsStacked01,
  Plus,
  Send01,
  ShieldTick,
  Target01,
  X,
} from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import {
  PayoutRecipientStatus,
  PayoutStatus,
  PayoutVisibility,
} from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { AppButton, AppTextarea } from '@/components/app'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { GlassCard } from './glass-card'
import { toast } from 'sonner'

interface PayoutsTabProps {
  projectId: string
  projectSlug: string
  isFounder: boolean
  payoutVisibility: string
}

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

export function PayoutsTab({
  projectId,
  projectSlug,
  isFounder,
  payoutVisibility,
}: PayoutsTabProps) {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id
  const isPublicMode = payoutVisibility === PayoutVisibility.PUBLIC

  const [markingSentId, setMarkingSentId] = useState<string | null>(null)
  const [sentNote, setSentNote] = useState('')
  const [showSentForm, setShowSentForm] = useState<string | null>(null)
  const [confirmingPayoutId, setConfirmingPayoutId] = useState<string | null>(
    null,
  )

  // Fetch payouts
  const { data: payouts, isLoading } = trpc.payout.getByProject.useQuery(
    { projectId },
    { enabled: !!projectId },
  )

  // Fetch stats
  const { data: stats } = trpc.payout.getProjectStats.useQuery(
    { projectId },
    { enabled: !!projectId },
  )

  // Fetch pool capacity stats (includes expansion events)
  const { data: poolStats } = trpc.project.getPoolStats.useQuery(
    { projectId },
    { enabled: !!projectId },
  )

  const utils = trpc.useUtils()

  const markSent = trpc.payout.markSent.useMutation({
    onSuccess: () => {
      toast.success('Payout marked as sent')
      setShowSentForm(null)
      setSentNote('')
      utils.payout.getByProject.invalidate({ projectId })
      utils.payout.getProjectStats.invalidate({ projectId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const confirmReceipt = trpc.payout.confirmReceipt.useMutation({
    onSuccess: () => {
      toast.success('Receipt confirmed!')
      setConfirmingPayoutId(null)
      utils.payout.getByProject.invalidate({ projectId })
      utils.payout.getProjectStats.invalidate({ projectId })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

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

  const handleConfirmReceipt = async (
    payoutId: string,
    confirmed: boolean,
    note?: string,
  ) => {
    setConfirmingPayoutId(payoutId)
    try {
      await confirmReceipt.mutateAsync({
        payoutId,
        confirmed,
        note,
      })
    } finally {
      setConfirmingPayoutId(null)
    }
  }

  if (isLoading) {
    return (
      <GlassCard className="p-4">
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </GlassCard>
    )
  }

  if (!payouts || payouts.length === 0) {
    return (
      <GlassCard className="py-12 text-center">
        <div className="mx-auto flex max-w-xs flex-col items-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <CoinsStacked01 className="size-6 text-primary" />
          </div>
          <h3 className="text-base font-semibold">No payouts yet</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isFounder
              ? 'Create your first payout to distribute the reward pool.'
              : 'Payouts will appear here once the founder distributes the reward pool.'}
          </p>
          {isFounder && (
            <AppButton asChild className="mt-4">
              <Link href={routes.project.newPayout({ slug: projectSlug })}>
                <Plus className="mr-2 size-4" />
                Create Payout
              </Link>
            </AppButton>
          )}
        </div>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={CoinsStacked01}
            value={formatCurrency(stats.totalPaidOutCents)}
            label="Total paid out"
            highlight
          />
          <StatCard
            icon={Calendar}
            value={stats.totalPayouts.toString()}
            label="Payouts"
          />
          <StatCard
            icon={ShieldTick}
            value={`${Math.round(stats.confirmationRate * 100)}%`}
            label="Confirmed"
          />
          {poolStats && (
            <StatCard
              icon={Target01}
              value={`${poolStats.earnedPoints}/${poolStats.poolCapacity}`}
              label="Pts earned/capacity"
            />
          )}
        </div>
      )}

      {/* Pool Expansion Timeline */}
      {poolStats &&
        poolStats.expansionEvents &&
        poolStats.expansionEvents.length > 0 && (
          <GlassCard className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2.5">
              <h3 className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                <ArrowUp className="size-3" />
                Pool Expansion History
              </h3>
            </div>
            <div className="divide-y divide-border">
              {poolStats.expansionEvents.map((event) => (
                <div key={event.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        Pool expanded: {event.previousCapacity} →{' '}
                        {event.newCapacity} pts
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {event.reason}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">
                        {parseFloat(event.dilutionPercent.toString()).toFixed(
                          1,
                        )}
                        % dilution
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(event.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

      {/* Founder: New Payout button */}
      {isFounder && (
        <div className="flex justify-end">
          <AppButton asChild size="sm">
            <Link href={routes.project.newPayout({ slug: projectSlug })}>
              <Plus className="mr-2 size-4" />
              New Payout
            </Link>
          </AppButton>
        </div>
      )}

      {/* Payout timeline */}
      <div className="space-y-4">
        {payouts.map((payout) => {
          const status =
            statusConfig[payout.status] || statusConfig[PayoutStatus.ANNOUNCED]
          const confirmedCount = payout.recipients.filter(
            (r) => r.status === PayoutRecipientStatus.CONFIRMED,
          ).length
          const disputedCount = payout.recipients.filter(
            (r) => r.status === PayoutRecipientStatus.DISPUTED,
          ).length

          // Check if current user is a recipient
          const myRecipient = currentUserId
            ? payout.recipients.find((r) => r.user.id === currentUserId)
            : null
          const canConfirm =
            myRecipient &&
            myRecipient.status === PayoutRecipientStatus.PENDING &&
            payout.status === PayoutStatus.SENT

          // Determine what amounts to show based on visibility rules
          const canSeeAmounts =
            isFounder || isPublicMode || myRecipient !== null

          return (
            <GlassCard key={payout.id} className="overflow-hidden p-0">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-border p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <h3 className="font-semibold">{payout.periodLabel}</h3>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', status.color)}
                    >
                      {status.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(payout.periodStart).toLocaleDateString()} –{' '}
                    {new Date(payout.periodEnd).toLocaleDateString()}
                  </p>
                </div>
                {canSeeAmounts && (
                  <div className="text-right">
                    <p className="font-semibold text-green-500">
                      {formatCurrency(payout.poolAmountCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      from {formatCurrency(payout.reportedProfitCents)} profit
                    </p>
                  </div>
                )}
              </div>

              {/* Recipients */}
              <div className="divide-y divide-border">
                {payout.recipients.map((recipient) => {
                  const recipientStatus =
                    recipientStatusConfig[recipient.status] ||
                    recipientStatusConfig[PayoutRecipientStatus.PENDING]
                  const StatusIcon = recipientStatus.icon
                  const isMe = recipient.user.id === currentUserId

                  // Show amounts if: founder, public mode, or it's the current user's amount
                  const showAmount = isFounder || isPublicMode || isMe

                  return (
                    <div
                      key={recipient.id}
                      className={cn(
                        'flex items-center justify-between px-4 py-3',
                        isMe && 'bg-primary/5',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="size-7">
                          <AvatarImage
                            src={recipient.user.image ?? undefined}
                          />
                          <AvatarFallback className="text-xs">
                            {recipient.user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {recipient.user.name}
                            {isMe && (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                (you)
                              </span>
                            )}
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
                        {showAmount ? (
                          <span className="font-semibold">
                            {formatCurrency(recipient.amountCents)}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                        <StatusIcon
                          className={cn('size-4', recipientStatus.color)}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer: stats + actions */}
              <div className="border-t border-border p-4">
                {/* Confirmation stats */}
                <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Check className="size-3 text-green-500" />
                    {confirmedCount} of {payout.recipients.length} confirmed
                  </span>
                  {disputedCount > 0 && (
                    <span className="flex items-center gap-1 text-red-500">
                      <AlertCircle className="size-3" />
                      {disputedCount} disputed
                    </span>
                  )}
                </div>

                {/* Founder: Mark as paid */}
                {isFounder && payout.status === PayoutStatus.ANNOUNCED && (
                  <>
                    {showSentForm === payout.id ? (
                      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
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
                        size="sm"
                      >
                        <Send01 className="mr-2 size-4" />
                        Mark as Paid
                      </AppButton>
                    )}
                  </>
                )}

                {/* Sent note */}
                {payout.status === PayoutStatus.SENT && payout.sentNote && (
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      <span className="font-medium">Payment note:</span>{' '}
                      {payout.sentNote}
                    </p>
                    {payout.sentAt && (
                      <p className="mt-1 text-xs text-blue-700/70 dark:text-blue-400/70">
                        Sent on {new Date(payout.sentAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Contributor: Confirm receipt */}
                {canConfirm && (
                  <div className="mt-3 flex items-center gap-2">
                    <AppButton
                      size="sm"
                      onClick={() =>
                        handleConfirmReceipt(payout.id, true, undefined)
                      }
                      disabled={confirmingPayoutId === payout.id}
                      className="flex-1"
                    >
                      {confirmingPayoutId === payout.id ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 size-4" />
                      )}
                      Confirm Received
                    </AppButton>
                    <AppButton
                      size="sm"
                      variant="outline"
                      onClick={() => handleConfirmReceipt(payout.id, false)}
                      disabled={confirmingPayoutId === payout.id}
                      className="text-red-500 hover:text-red-600"
                    >
                      <X className="mr-2 size-4" />
                      Not Received
                    </AppButton>
                  </div>
                )}
              </div>
            </GlassCard>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  value,
  label,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: string
  label: string
  highlight?: boolean
}) {
  return (
    <GlassCard className="p-3">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex size-6 items-center justify-center rounded-sm',
            highlight ? 'bg-green-500/10' : 'bg-muted',
          )}
        >
          <Icon
            className={cn(
              'size-3.5',
              highlight ? 'text-green-500' : 'text-muted-foreground',
            )}
          />
        </div>
        <div>
          <p className={cn('text-sm font-bold', highlight && 'text-green-500')}>
            {value}
          </p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      </div>
    </GlassCard>
  )
}
