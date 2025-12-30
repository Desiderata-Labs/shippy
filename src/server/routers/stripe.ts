import { StripeConnectAccountStatus } from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/zod'
import { protectedProcedure, publicProcedure, router } from '../trpc'
import {
  createConnectAccount,
  createPayoutCheckout,
  getAccountStatus,
  getDashboardLink,
  getOnboardingLink,
  getPayoutPaymentStatus,
  isStripeConfigured,
  retryRecipientTransfer,
} from '@/server/services/stripe'
import { z } from 'zod'

export const stripeRouter = router({
  /**
   * Check if Stripe is configured on the platform
   */
  isConfigured: publicProcedure.query(async () => {
    return { configured: isStripeConfigured() }
  }),

  /**
   * Get the current user's Stripe Connect account status
   */
  getAccountStatus: protectedProcedure.query(async ({ ctx }) => {
    const result = await getAccountStatus({
      prisma: ctx.prisma,
      userId: ctx.session.user.id,
    })

    if (!result.success) {
      return {
        hasAccount: false,
        accountId: null,
        status: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        requiresAction: false,
      }
    }

    return result.account
  }),

  /**
   * Create a new Stripe Connect Express account and start onboarding
   */
  createAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await createConnectAccount({
      prisma: ctx.prisma,
      userId: ctx.session.user.id,
    })

    if (!result.success) {
      throw new Error(result.message)
    }

    return {
      accountId: result.accountId,
      onboardingUrl: result.onboardingUrl,
    }
  }),

  /**
   * Get a new onboarding link for continuing setup
   */
  getOnboardingLink: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await getOnboardingLink({
      prisma: ctx.prisma,
      userId: ctx.session.user.id,
    })

    if (!result.success) {
      throw new Error(result.message)
    }

    return {
      onboardingUrl: result.onboardingUrl,
    }
  }),

  /**
   * Get a login link to the Stripe Express dashboard
   */
  getDashboardLink: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await getDashboardLink({
      prisma: ctx.prisma,
      userId: ctx.session.user.id,
    })

    if (!result.success) {
      throw new Error(result.message)
    }

    return {
      dashboardUrl: result.dashboardUrl,
    }
  }),

  /**
   * Check if account can receive payouts (convenience query)
   */
  canReceivePayouts: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        stripeConnectAccountId: true,
        stripeConnectAccountStatus: true,
      },
    })

    if (!user?.stripeConnectAccountId) {
      return { canReceive: false, reason: 'no_account' as const }
    }

    if (user.stripeConnectAccountStatus !== StripeConnectAccountStatus.ACTIVE) {
      return { canReceive: false, reason: 'not_active' as const }
    }

    return { canReceive: true, reason: null }
  }),

  // ================================
  // Payout Checkout (Founder Payments)
  // ================================

  /**
   * Get payment status for a payout
   */
  getPayoutPaymentStatus: protectedProcedure
    .input(z.object({ payoutId: nanoId() }))
    .query(async ({ ctx, input }) => {
      const result = await getPayoutPaymentStatus({
        prisma: ctx.prisma,
        payoutId: input.payoutId,
        userId: ctx.session.user.id,
      })

      if (!result.success) {
        throw new Error(result.message)
      }

      return {
        paymentStatus: result.paymentStatus,
        stripeFeeCents: result.stripeFeeCents,
        founderTotalCents: result.founderTotalCents,
        paidAt: result.paidAt,
      }
    }),

  /**
   * Create a Stripe Checkout session for founder to pay for a payout
   * Returns the checkout URL to redirect the founder to
   */
  createPayoutCheckout: protectedProcedure
    .input(
      z.object({
        payoutId: nanoId(),
        projectSlug: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await createPayoutCheckout({
        prisma: ctx.prisma,
        payoutId: input.payoutId,
        userId: ctx.session.user.id,
        projectSlug: input.projectSlug,
      })

      if (!result.success) {
        throw new Error(result.message)
      }

      return {
        checkoutUrl: result.checkoutUrl,
        sessionId: result.sessionId,
        breakdown: result.breakdown,
      }
    }),

  /**
   * Retry transfer for a specific payout recipient.
   * Allows a contributor to manually trigger a transfer if automatic processing failed.
   */
  retryRecipientTransfer: protectedProcedure
    .input(z.object({ recipientId: nanoId() }))
    .mutation(async ({ ctx, input }) => {
      const result = await retryRecipientTransfer({
        prisma: ctx.prisma,
        recipientId: input.recipientId,
        userId: ctx.session.user.id,
      })

      if (!result.success) {
        throw new Error(result.message)
      }

      return {
        transferId: result.transferId,
        amountCents: result.amountCents,
      }
    }),
})
