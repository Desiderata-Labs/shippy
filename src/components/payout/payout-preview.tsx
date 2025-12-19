'use client'

import { Loader2 } from 'lucide-react'
import { getChartColor } from '@/lib/chart-colors'
import { PoolType } from '@/lib/db/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function formatPercentage(value: number): string {
  return value.toFixed(1) + '%'
}

interface PreviewRecipient {
  userId: string
  userName: string
  userImage: string | null
  points: number
  sharePercent: number
  amountCents: number
}

interface PayoutPreviewData {
  poolType: string
  poolAmountCents: number
  poolPercentage: number
  poolCapacity: number
  platformFeePercentage: number
  platformFeeCents: number
  distributedAmountCents: number
  totalEarnedPoints: number
  breakdown: PreviewRecipient[]
  budgetInfo?: {
    budgetCents: number
    spentCents: number
    remainingCents: number
  } | null
}

interface PayoutPreviewProps {
  preview: PayoutPreviewData | undefined
  isLoading: boolean
  isFetching: boolean
  periodLabel: string
  hasValidAmount: boolean
  poolType: string
}

/**
 * Shared preview component for payout distribution.
 * Shows the recipient breakdown and distribution visualization.
 */
export function PayoutPreview({
  preview,
  isLoading,
  isFetching,
  periodLabel,
  hasValidAmount,
  poolType,
}: PayoutPreviewProps) {
  return (
    <div className="pt-2">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {periodLabel || 'Distribution'} Split
        </span>
        {isFetching && (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        )}
      </div>

      {!hasValidAmount ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {poolType === PoolType.FIXED_BUDGET
              ? 'Enter a distribution amount to preview the split'
              : 'Enter a profit amount to preview the split'}
          </p>
        </div>
      ) : isLoading && !preview ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : preview ? (
        <div className="space-y-4">
          {preview.breakdown.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No contributors with points
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Approve submissions first
              </p>
            </div>
          ) : (
            <>
              {/* Distribution bar - shows money split including platform fee */}
              <div className="flex h-8 overflow-hidden rounded-lg bg-muted/50">
                {preview.breakdown.map((recipient, index) => {
                  // Show as % of total pool amount (including platform fee)
                  const amountPercent =
                    (recipient.amountCents / preview.poolAmountCents) * 100
                  return (
                    <motion.div
                      key={recipient.userId}
                      initial={{ width: 0 }}
                      animate={{ width: `${amountPercent}%` }}
                      transition={{
                        duration: 0.6,
                        delay: index * 0.08,
                        ease: [0.34, 1.56, 0.64, 1],
                      }}
                      className="h-full hover:opacity-80"
                      style={{
                        backgroundColor: getChartColor(index),
                      }}
                      title={`${recipient.userName}: ${formatCurrency(recipient.amountCents)} (${formatPercentage(amountPercent)})`}
                    />
                  )
                })}
                {/* Shippy platform fee segment */}
                {preview.platformFeeCents > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(preview.platformFeeCents / preview.poolAmountCents) * 100}%`,
                    }}
                    transition={{
                      duration: 0.6,
                      delay: preview.breakdown.length * 0.08,
                      ease: [0.34, 1.56, 0.64, 1],
                    }}
                    className="h-full hover:opacity-80"
                    style={{
                      backgroundColor: getChartColor(preview.breakdown.length),
                    }}
                    title={`Shippy: ${formatCurrency(preview.platformFeeCents)} (${formatPercentage((preview.platformFeeCents / preview.poolAmountCents) * 100)})`}
                  />
                )}
                {/* Undistributed portion */}
                {(() => {
                  const distributedCents =
                    preview.distributedAmountCents + preview.platformFeeCents
                  const undistributedPercent =
                    ((preview.poolAmountCents - distributedCents) /
                      preview.poolAmountCents) *
                    100
                  return undistributedPercent > 0 ? (
                    <div className="flex-1" />
                  ) : null
                })()}
              </div>

              {/* Contributors list */}
              <div className="space-y-2">
                {preview.breakdown.map((recipient, index) => (
                  <div
                    key={recipient.userId}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="size-2.5 rounded-full"
                        style={{
                          backgroundColor: getChartColor(index),
                        }}
                      />
                      <Avatar className="size-6">
                        <AvatarImage src={recipient.userImage ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {recipient.userName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {recipient.userName}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-primary">
                        {formatCurrency(recipient.amountCents)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {recipient.points} pts (
                        {formatPercentage(
                          (recipient.amountCents / preview.poolAmountCents) *
                            100,
                        )}
                        )
                      </div>
                    </div>
                  </div>
                ))}

                {/* Shippy Platform Fee */}
                {preview.platformFeeCents > 0 &&
                  (() => {
                    const shippyColor = getChartColor(preview.breakdown.length)
                    return (
                      <div
                        className="flex items-center justify-between rounded-lg border px-3 py-2.5"
                        style={{
                          borderColor: shippyColor,
                          backgroundColor: shippyColor.replace(')', ' / 0.1)'),
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/logo-mark.svg"
                            alt="Shippy"
                            className="size-6"
                          />
                          <div>
                            <span className="text-sm font-medium">Shippy</span>
                            <p className="text-[10px] text-muted-foreground">
                              Platform fee ({preview.platformFeePercentage}%
                              {poolType === PoolType.PROFIT_SHARE
                                ? ' of profit share'
                                : ' of distribution'}
                              )
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-muted-foreground">
                            {formatCurrency(preview.platformFeeCents)}
                          </div>
                          <a
                            href="mailto:pay@shippy.sh"
                            className="text-[10px] text-muted-foreground underline"
                          >
                            pay@shippy.sh
                          </a>
                        </div>
                      </div>
                    )
                  })()}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-medium">Total</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(
                    preview.distributedAmountCents + preview.platformFeeCents,
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

