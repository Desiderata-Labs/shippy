import { prisma as globalPrisma } from '@/lib/db/server'
import {
  NotificationReferenceType,
  NotificationType,
  PayoutPaymentStatus,
  StripeConnectAccountStatus,
} from '@/lib/db/types'
import {
  type PaymentMethodType,
  getPaymentMethodsForAmount,
} from '@/lib/stripe/fees'
import {
  getAppUrl,
  getConnectRefreshUrl,
  getConnectReturnUrl,
  getStripeClient,
} from '@/lib/stripe/server'
import { createSystemNotification } from '@/server/routers/notification'
import type { Prisma, PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'

// Type for either PrismaClient or a transaction client
type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

// ================================
// Stripe Client Interface (for testing)
// ================================

/**
 * Interface for Stripe operations that can be mocked in tests
 */
export interface StripeOperations {
  createExpressAccount(params: {
    email: string
    metadata?: Record<string, string>
  }): Promise<{ id: string }>

  createAccountLink(params: {
    accountId: string
    refreshUrl: string
    returnUrl: string
    type: 'account_onboarding' | 'account_update'
  }): Promise<{ url: string; expiresAt: number }>

  retrieveAccount(accountId: string): Promise<{
    id: string
    chargesEnabled: boolean
    payoutsEnabled: boolean
    detailsSubmitted: boolean
    requirements?: {
      currentlyDue?: string[]
      eventuallyDue?: string[]
      pastDue?: string[]
      disabledReason?: string | null
    }
  }>

  createTransfer(params: {
    amount: number
    currency: string
    destination: string
    metadata?: Record<string, string>
  }): Promise<{ id: string }>

  createLoginLink(accountId: string): Promise<{ url: string }>

  createCheckoutSession(params: {
    amountCents: number
    currency: string
    customerEmail: string
    successUrl: string
    cancelUrl: string
    metadata: Record<string, string>
    lineItemDescription: string
    paymentMethodTypes?: PaymentMethodType[]
  }): Promise<{ id: string; url: string }>

  retrieveCheckoutSession(sessionId: string): Promise<{
    id: string
    paymentStatus: string
    paymentIntent: string | null
    amountTotal: number | null
  }>
}

/**
 * Real Stripe operations using the Stripe SDK
 */
export function createRealStripeOperations(): StripeOperations {
  const stripe = getStripeClient()

  return {
    async createExpressAccount({ email, metadata }) {
      const account = await stripe.accounts.create({
        type: 'express',
        email,
        metadata,
        capabilities: {
          transfers: { requested: true },
        },
      })
      return { id: account.id }
    },

    async createAccountLink({ accountId, refreshUrl, returnUrl, type }) {
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type,
      })
      return { url: link.url, expiresAt: link.expires_at }
    },

    async retrieveAccount(accountId) {
      const account = await stripe.accounts.retrieve(accountId)
      return {
        id: account.id,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        detailsSubmitted: account.details_submitted ?? false,
        requirements: account.requirements
          ? {
              currentlyDue: account.requirements.currently_due ?? undefined,
              eventuallyDue: account.requirements.eventually_due ?? undefined,
              pastDue: account.requirements.past_due ?? undefined,
              disabledReason: account.requirements.disabled_reason ?? null,
            }
          : undefined,
      }
    },

    async createTransfer({ amount, currency, destination, metadata }) {
      const transfer = await stripe.transfers.create({
        amount,
        currency,
        destination,
        metadata,
      })
      return { id: transfer.id }
    },

    async createLoginLink(accountId) {
      const link = await stripe.accounts.createLoginLink(accountId)
      return { url: link.url }
    },

    async createCheckoutSession({
      amountCents,
      currency,
      customerEmail,
      successUrl,
      cancelUrl,
      metadata,
      lineItemDescription,
      paymentMethodTypes = ['card'],
    }) {
      // Build payment method options based on allowed types
      const includesCard = paymentMethodTypes.includes('card')
      const includesAch = paymentMethodTypes.includes('us_bank_account')

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: paymentMethodTypes,
        customer_email: customerEmail,
        // Fraud prevention: Always request 3D Secure for card payments
        ...(includesCard && {
          payment_intent_data: {
            setup_future_usage: undefined, // Don't save card for future use
          },
          payment_method_options: {
            card: {
              request_three_d_secure: 'any', // Always request 3DS when available
            },
          },
        }),
        // ACH-specific options
        ...(includesAch && {
          payment_method_options: {
            ...((includesCard && {
              card: {
                request_three_d_secure: 'any',
              },
            }) ||
              {}),
            us_bank_account: {
              financial_connections: {
                permissions: ['payment_method'], // Instant verification via Plaid
              },
              verification_method: 'instant', // Prefer instant over microdeposits
            },
          },
        }),
        line_items: [
          {
            price_data: {
              currency,
              unit_amount: amountCents,
              product_data: {
                name: 'Payout Funding',
                description: lineItemDescription,
              },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata,
      })
      return { id: session.id, url: session.url! }
    },

    async retrieveCheckoutSession(sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      return {
        id: session.id,
        paymentStatus: session.payment_status,
        paymentIntent:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
        amountTotal: session.amount_total,
      }
    },
  }
}

// Default to real operations (can be overridden in tests)
let stripeOps: StripeOperations = createRealStripeOperations()

/**
 * Set custom Stripe operations (for testing)
 */
export function setStripeOperations(ops: StripeOperations): void {
  stripeOps = ops
}

/**
 * Reset to real Stripe operations
 */
export function resetStripeOperations(): void {
  stripeOps = createRealStripeOperations()
}

// ================================
// Create Connect Account Service
// ================================

export interface CreateConnectAccountParams {
  prisma?: PrismaClientOrTx
  userId: string
}

export interface CreateConnectAccountResult {
  success: true
  accountId: string
  onboardingUrl: string
}

export type CreateConnectAccountError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'ALREADY_EXISTS'; message: string }
  | { success: false; code: 'STRIPE_ERROR'; message: string }

/**
 * Create a Stripe Connect Express account for a user
 *
 * This handles:
 * - Checking if user already has an account
 * - Creating a new Express account
 * - Generating an onboarding link
 * - Saving the account ID to the database
 */
export async function createConnectAccount({
  prisma = globalPrisma,
  userId,
}: CreateConnectAccountParams): Promise<
  CreateConnectAccountResult | CreateConnectAccountError
> {
  // Get the user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      stripeConnectAccountId: true,
    },
  })

  if (!user) {
    return { success: false, code: 'NOT_FOUND', message: 'User not found' }
  }

  // Check if user already has a Stripe account
  if (user.stripeConnectAccountId) {
    return {
      success: false,
      code: 'ALREADY_EXISTS',
      message: 'User already has a Stripe Connect account',
    }
  }

  try {
    // Create the Express account
    const account = await stripeOps.createExpressAccount({
      email: user.email,
      metadata: {
        userId: user.id,
        userName: user.name,
        platform: 'shippy',
      },
    })

    // Create the onboarding link
    const link = await stripeOps.createAccountLink({
      accountId: account.id,
      refreshUrl: getConnectRefreshUrl(),
      returnUrl: getConnectReturnUrl(),
      type: 'account_onboarding',
    })

    // Save the account ID to the user
    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeConnectAccountId: account.id,
        stripeConnectAccountStatus: StripeConnectAccountStatus.PENDING,
      },
    })

    return {
      success: true,
      accountId: account.id,
      onboardingUrl: link.url,
    }
  } catch (error) {
    console.error('Stripe Connect account creation failed:', error)
    return {
      success: false,
      code: 'STRIPE_ERROR',
      message:
        error instanceof Error ? error.message : 'Failed to create account',
    }
  }
}

// ================================
// Get Onboarding Link Service
// ================================

export interface GetOnboardingLinkParams {
  prisma?: PrismaClientOrTx
  userId: string
}

export interface GetOnboardingLinkResult {
  success: true
  onboardingUrl: string
  expiresAt: number
}

export type GetOnboardingLinkError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'NO_ACCOUNT'; message: string }
  | { success: false; code: 'ALREADY_ACTIVE'; message: string }
  | { success: false; code: 'STRIPE_ERROR'; message: string }

/**
 * Get a new onboarding link for an existing Stripe Connect account
 *
 * Used when the user needs to continue or refresh their onboarding
 */
export async function getOnboardingLink({
  prisma = globalPrisma,
  userId,
}: GetOnboardingLinkParams): Promise<
  GetOnboardingLinkResult | GetOnboardingLinkError
> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      stripeConnectAccountId: true,
      stripeConnectAccountStatus: true,
    },
  })

  if (!user) {
    return { success: false, code: 'NOT_FOUND', message: 'User not found' }
  }

  if (!user.stripeConnectAccountId) {
    return {
      success: false,
      code: 'NO_ACCOUNT',
      message: 'User does not have a Stripe Connect account',
    }
  }

  // If already active, they don't need onboarding
  if (user.stripeConnectAccountStatus === StripeConnectAccountStatus.ACTIVE) {
    return {
      success: false,
      code: 'ALREADY_ACTIVE',
      message: 'Account is already active',
    }
  }

  try {
    const link = await stripeOps.createAccountLink({
      accountId: user.stripeConnectAccountId,
      refreshUrl: getConnectRefreshUrl(),
      returnUrl: getConnectReturnUrl(),
      type: 'account_onboarding',
    })

    // Update status to ONBOARDING if it was PENDING
    if (
      user.stripeConnectAccountStatus === StripeConnectAccountStatus.PENDING
    ) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          stripeConnectAccountStatus: StripeConnectAccountStatus.ONBOARDING,
        },
      })
    }

    return {
      success: true,
      onboardingUrl: link.url,
      expiresAt: link.expiresAt,
    }
  } catch (error) {
    console.error('Failed to create onboarding link:', error)
    return {
      success: false,
      code: 'STRIPE_ERROR',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to create onboarding link',
    }
  }
}

// ================================
// Get Account Status Service
// ================================

export interface GetAccountStatusParams {
  prisma?: PrismaClientOrTx
  userId: string
}

export interface AccountStatus {
  hasAccount: boolean
  accountId: string | null
  status: StripeConnectAccountStatus | null
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requiresAction: boolean
  requirements?: {
    currentlyDue?: string[]
    eventuallyDue?: string[]
    pastDue?: string[]
    disabledReason?: string | null
  }
}

export interface GetAccountStatusResult {
  success: true
  account: AccountStatus
}

export type GetAccountStatusError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'STRIPE_ERROR'; message: string }

/**
 * Get the current status of a user's Stripe Connect account
 *
 * This syncs with Stripe to get the latest status
 */
export async function getAccountStatus({
  prisma = globalPrisma,
  userId,
}: GetAccountStatusParams): Promise<
  GetAccountStatusResult | GetAccountStatusError
> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      stripeConnectAccountId: true,
      stripeConnectAccountStatus: true,
      stripeConnectOnboardedAt: true,
    },
  })

  if (!user) {
    return { success: false, code: 'NOT_FOUND', message: 'User not found' }
  }

  // No account yet
  if (!user.stripeConnectAccountId) {
    return {
      success: true,
      account: {
        hasAccount: false,
        accountId: null,
        status: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        requiresAction: false,
      },
    }
  }

  try {
    // Fetch fresh status from Stripe
    const stripeAccount = await stripeOps.retrieveAccount(
      user.stripeConnectAccountId,
    )

    // Determine the status
    const newStatus = determineAccountStatus(stripeAccount)

    // Update our database if status changed
    if (newStatus !== user.stripeConnectAccountStatus) {
      const updateData: Prisma.UserUpdateInput = {
        stripeConnectAccountStatus: newStatus,
      }

      // Set onboarded timestamp when becoming active
      if (
        newStatus === StripeConnectAccountStatus.ACTIVE &&
        !user.stripeConnectOnboardedAt
      ) {
        updateData.stripeConnectOnboardedAt = new Date()
      }

      await prisma.user.update({
        where: { id: userId },
        data: updateData,
      })
    }

    const requiresAction =
      (stripeAccount.requirements?.currentlyDue?.length ?? 0) > 0 ||
      (stripeAccount.requirements?.pastDue?.length ?? 0) > 0

    return {
      success: true,
      account: {
        hasAccount: true,
        accountId: stripeAccount.id,
        status: newStatus,
        chargesEnabled: stripeAccount.chargesEnabled,
        payoutsEnabled: stripeAccount.payoutsEnabled,
        detailsSubmitted: stripeAccount.detailsSubmitted,
        requiresAction,
        requirements: stripeAccount.requirements,
      },
    }
  } catch (error) {
    console.error('Failed to get Stripe account status:', error)
    return {
      success: false,
      code: 'STRIPE_ERROR',
      message:
        error instanceof Error ? error.message : 'Failed to get account status',
    }
  }
}

/**
 * Determine the account status based on Stripe account state
 */
function determineAccountStatus(account: {
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requirements?: {
    disabledReason?: string | null
  }
}): StripeConnectAccountStatus {
  // Account is disabled
  if (account.requirements?.disabledReason) {
    return StripeConnectAccountStatus.DISABLED
  }

  // Account is fully active
  if (account.chargesEnabled && account.payoutsEnabled) {
    return StripeConnectAccountStatus.ACTIVE
  }

  // Details submitted but not yet fully enabled (restricted)
  if (account.detailsSubmitted) {
    return StripeConnectAccountStatus.RESTRICTED
  }

  // Still in onboarding process
  return StripeConnectAccountStatus.ONBOARDING
}

// ================================
// Get Dashboard Link Service
// ================================

export interface GetDashboardLinkParams {
  prisma?: PrismaClientOrTx
  userId: string
}

export interface GetDashboardLinkResult {
  success: true
  dashboardUrl: string
}

export type GetDashboardLinkError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'NO_ACCOUNT'; message: string }
  | { success: false; code: 'NOT_ACTIVE'; message: string }
  | { success: false; code: 'STRIPE_ERROR'; message: string }

/**
 * Get a login link to the Stripe Express dashboard
 *
 * Only available for active accounts
 */
export async function getDashboardLink({
  prisma = globalPrisma,
  userId,
}: GetDashboardLinkParams): Promise<
  GetDashboardLinkResult | GetDashboardLinkError
> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      stripeConnectAccountId: true,
      stripeConnectAccountStatus: true,
    },
  })

  if (!user) {
    return { success: false, code: 'NOT_FOUND', message: 'User not found' }
  }

  if (!user.stripeConnectAccountId) {
    return {
      success: false,
      code: 'NO_ACCOUNT',
      message: 'User does not have a Stripe Connect account',
    }
  }

  if (user.stripeConnectAccountStatus !== StripeConnectAccountStatus.ACTIVE) {
    return {
      success: false,
      code: 'NOT_ACTIVE',
      message: 'Account is not fully active yet',
    }
  }

  try {
    const link = await stripeOps.createLoginLink(user.stripeConnectAccountId)

    return {
      success: true,
      dashboardUrl: link.url,
    }
  } catch (error) {
    console.error('Failed to create dashboard link:', error)
    return {
      success: false,
      code: 'STRIPE_ERROR',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to create dashboard link',
    }
  }
}

// ================================
// Transfer Funds Service
// ================================

export interface TransferFundsParams {
  prisma?: PrismaClientOrTx
  recipientUserId: string
  amountCents: number
  currency?: string
  metadata?: {
    payoutId?: string
    recipientId?: string
    projectId?: string
    projectSlug?: string
    periodLabel?: string
    retroactive?: string // 'true' if this is a retroactive transfer
    recipientCount?: string // Number of recipients aggregated in this transfer (carry-forward)
  }
}

export interface TransferFundsResult {
  success: true
  transferId: string
  amountCents: number
}

export type TransferFundsError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'NO_ACCOUNT'; message: string }
  | { success: false; code: 'NOT_ACTIVE'; message: string }
  | { success: false; code: 'INVALID_AMOUNT'; message: string }
  | { success: false; code: 'STRIPE_ERROR'; message: string }
  | { success: false; code: 'INSUFFICIENT_FUNDS'; message: string }

/**
 * Transfer funds to a contributor's Stripe Connect account
 *
 * This is used during automated payouts to transfer the contributor's share
 */
export async function transferFunds({
  prisma = globalPrisma,
  recipientUserId,
  amountCents,
  currency = 'usd',
  metadata = {},
}: TransferFundsParams): Promise<TransferFundsResult | TransferFundsError> {
  if (amountCents <= 0) {
    return {
      success: false,
      code: 'INVALID_AMOUNT',
      message: 'Amount must be positive',
    }
  }

  // Minimum transfer amount (Stripe requires at least $0.50 for USD)
  const minimumAmountCents = 50
  if (amountCents < minimumAmountCents) {
    return {
      success: false,
      code: 'INVALID_AMOUNT',
      message: `Amount must be at least $${(minimumAmountCents / 100).toFixed(2)}`,
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: recipientUserId },
    select: {
      id: true,
      stripeConnectAccountId: true,
      stripeConnectAccountStatus: true,
    },
  })

  if (!user) {
    return { success: false, code: 'NOT_FOUND', message: 'User not found' }
  }

  if (!user.stripeConnectAccountId) {
    return {
      success: false,
      code: 'NO_ACCOUNT',
      message: 'User does not have a Stripe Connect account',
    }
  }

  if (user.stripeConnectAccountStatus !== StripeConnectAccountStatus.ACTIVE) {
    return {
      success: false,
      code: 'NOT_ACTIVE',
      message: 'User Stripe account is not active',
    }
  }

  try {
    const transfer = await stripeOps.createTransfer({
      amount: amountCents,
      currency,
      destination: user.stripeConnectAccountId,
      metadata: {
        userId: recipientUserId,
        platform: 'shippy',
        ...metadata,
      },
    })

    return {
      success: true,
      transferId: transfer.id,
      amountCents,
    }
  } catch (error) {
    console.error('Stripe transfer failed:', error)

    // Detect specific Stripe errors and provide user-friendly messages
    const errorMessage =
      error instanceof Error ? error.message : 'Transfer failed'

    // Insufficient funds error (common in test mode)
    if (errorMessage.includes('insufficient')) {
      return {
        success: false,
        code: 'INSUFFICIENT_FUNDS',
        message:
          'Platform has insufficient available funds for transfers. ' +
          'In test mode, use card 4000000000000077 which adds funds directly to available balance. ' +
          'In production, funds may still be settling (typically 2 business days).',
      }
    }

    return {
      success: false,
      code: 'STRIPE_ERROR',
      message: errorMessage,
    }
  }
}

// ================================
// Process Payout Transfers
// ================================

interface ProcessPayoutTransfersParams {
  prisma?: PrismaClientOrTx
  payoutId: string
}

interface RecipientTransferResult {
  recipientId: string
  userId: string
  username: string | null
  amountCents: number
  success: boolean
  transferId?: string
  error?: string
  reason?: 'NO_ACCOUNT' | 'NOT_ACTIVE' | 'TRANSFER_FAILED' | 'BELOW_MINIMUM'
}

type ProcessPayoutTransfersResult = {
  success: true
  payoutId: string
  results: RecipientTransferResult[]
  summary: {
    total: number
    paid: number
    failed: number
    skipped: number
  }
}

type ProcessPayoutTransfersError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'NOT_PAID'; message: string }

/**
 * Process Stripe transfers for all eligible recipients of a payout
 *
 * Called after founder payment is confirmed. Only transfers to recipients
 * with active Stripe Connect accounts.
 */
export async function processPayoutTransfers({
  prisma = globalPrisma,
  payoutId,
}: ProcessPayoutTransfersParams): Promise<
  ProcessPayoutTransfersResult | ProcessPayoutTransfersError
> {
  // Get the payout with all recipients
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    select: {
      id: true,
      paymentStatus: true,
      project: {
        select: { id: true, slug: true, name: true, founderId: true },
      },
      recipients: {
        select: {
          id: true,
          amountCents: true,
          paidAt: true,
          stripeTransferId: true,
          user: {
            select: {
              id: true,
              username: true,
              stripeConnectAccountId: true,
              stripeConnectAccountStatus: true,
            },
          },
        },
      },
    },
  })

  if (!payout) {
    return { success: false, code: 'NOT_FOUND', message: 'Payout not found' }
  }

  // Only process if founder has paid
  if (payout.paymentStatus !== PayoutPaymentStatus.PAID) {
    return {
      success: false,
      code: 'NOT_PAID',
      message: 'Founder payment not yet confirmed',
    }
  }

  const results: RecipientTransferResult[] = []

  for (const recipient of payout.recipients) {
    const amountCents = Number(recipient.amountCents)

    // Skip if already paid
    if (recipient.paidAt || recipient.stripeTransferId) {
      results.push({
        recipientId: recipient.id,
        userId: recipient.user.id,
        username: recipient.user.username,
        amountCents,
        success: true,
        transferId: recipient.stripeTransferId ?? undefined,
      })
      continue
    }

    // Check if user has Stripe Connect
    if (!recipient.user.stripeConnectAccountId) {
      results.push({
        recipientId: recipient.id,
        userId: recipient.user.id,
        username: recipient.user.username,
        amountCents,
        success: false,
        reason: 'NO_ACCOUNT',
        error: 'No Stripe Connect account',
      })
      continue
    }

    // Check if account is active
    if (
      recipient.user.stripeConnectAccountStatus !==
      StripeConnectAccountStatus.ACTIVE
    ) {
      results.push({
        recipientId: recipient.id,
        userId: recipient.user.id,
        username: recipient.user.username,
        amountCents,
        success: false,
        reason: 'NOT_ACTIVE',
        error: `Stripe account status: ${recipient.user.stripeConnectAccountStatus}`,
      })
      continue
    }

    // Check minimum amount ($0.50)
    if (amountCents < 50) {
      results.push({
        recipientId: recipient.id,
        userId: recipient.user.id,
        username: recipient.user.username,
        amountCents,
        success: false,
        reason: 'BELOW_MINIMUM',
        error: 'Amount below Stripe minimum ($0.50)',
      })
      continue
    }

    // Attempt the transfer
    const transferResult = await transferFunds({
      prisma,
      recipientUserId: recipient.user.id,
      amountCents,
      metadata: {
        payoutId: payout.id,
        recipientId: recipient.id,
        projectSlug: payout.project.slug,
      },
    })

    if (transferResult.success) {
      // Update recipient with transfer info
      await prisma.payoutRecipient.update({
        where: { id: recipient.id },
        data: {
          paidAt: new Date(),
          stripeTransferId: transferResult.transferId,
        },
      })

      // Send notification to recipient that they've been paid
      // Use system notification to ensure it goes through even if founder pays themselves
      await createSystemNotification({
        prisma,
        type: NotificationType.PAYOUT_TRANSFER_SENT,
        referenceType: NotificationReferenceType.PAYOUT,
        referenceId: payout.id,
        recipientId: recipient.user.id,
      })

      results.push({
        recipientId: recipient.id,
        userId: recipient.user.id,
        username: recipient.user.username,
        amountCents,
        success: true,
        transferId: transferResult.transferId,
      })
    } else {
      // If transfer failed due to no Stripe Connect, notify them to set it up
      if (
        transferResult.code === 'NO_ACCOUNT' ||
        transferResult.code === 'NOT_ACTIVE'
      ) {
        await createSystemNotification({
          prisma,
          type: NotificationType.PAYOUT_TRANSFER_PENDING,
          referenceType: NotificationReferenceType.PAYOUT,
          referenceId: payout.id,
          recipientId: recipient.user.id,
        })
      }

      results.push({
        recipientId: recipient.id,
        userId: recipient.user.id,
        username: recipient.user.username,
        amountCents,
        success: false,
        reason: 'TRANSFER_FAILED',
        error: transferResult.message,
      })
    }
  }

  // Calculate summary
  const paid = results.filter((r) => r.success).length
  const failed = results.filter(
    (r) => !r.success && r.reason === 'TRANSFER_FAILED',
  ).length
  const skipped = results.filter(
    (r) => !r.success && r.reason !== 'TRANSFER_FAILED',
  ).length

  return {
    success: true,
    payoutId,
    results,
    summary: {
      total: results.length,
      paid,
      failed,
      skipped,
    },
  }
}

// ================================
// Process Pending Transfers for User
// ================================

interface ProcessPendingTransfersForUserParams {
  prisma?: PrismaClientOrTx
  userId: string
}

type ProcessPendingTransfersForUserResult =
  | {
      success: true
      transfersProcessed: number
      transfersFailed: number
      totalAmountCents: number
    }
  | { success: false; code: 'NOT_FOUND' | 'NOT_ACTIVE'; message: string }

/**
 * Process any pending payout transfers for a user who just completed Stripe Connect setup.
 *
 * This is called when a user's Stripe account becomes ACTIVE, to pay out any
 * payouts they missed because they didn't have an account yet.
 */
export async function processPendingTransfersForUser({
  prisma = globalPrisma,
  userId,
}: ProcessPendingTransfersForUserParams): Promise<ProcessPendingTransfersForUserResult> {
  // Get user's Stripe account info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      stripeConnectAccountId: true,
      stripeConnectAccountStatus: true,
    },
  })

  if (!user) {
    return { success: false, code: 'NOT_FOUND', message: 'User not found' }
  }

  if (
    !user.stripeConnectAccountId ||
    user.stripeConnectAccountStatus !== StripeConnectAccountStatus.ACTIVE
  ) {
    return {
      success: false,
      code: 'NOT_ACTIVE',
      message: 'User does not have an active Stripe Connect account',
    }
  }

  // Find all unpaid payout recipients for this user where:
  // 1. The payout has been paid by the founder (paymentStatus = PAID)
  // 2. The recipient hasn't been paid yet (paidAt = null, stripeTransferId = null)
  const unpaidRecipients = await prisma.payoutRecipient.findMany({
    where: {
      userId,
      paidAt: null,
      stripeTransferId: null,
      payout: {
        paymentStatus: PayoutPaymentStatus.PAID,
      },
    },
    select: {
      id: true,
      amountCents: true,
      payout: {
        select: {
          id: true,
          projectId: true,
          project: {
            select: { slug: true, founderId: true },
          },
        },
      },
    },
  })

  if (unpaidRecipients.length === 0) {
    return {
      success: true,
      transfersProcessed: 0,
      transfersFailed: 0,
      totalAmountCents: 0,
    }
  }

  // Group recipients by project (carry-forward aggregation)
  const recipientsByProject = new Map<
    string,
    {
      projectSlug: string
      founderId: string
      recipients: typeof unpaidRecipients
      totalCents: number
    }
  >()

  for (const recipient of unpaidRecipients) {
    const projectId = recipient.payout.projectId
    const existing = recipientsByProject.get(projectId)
    if (existing) {
      existing.recipients.push(recipient)
      existing.totalCents += Number(recipient.amountCents)
    } else {
      recipientsByProject.set(projectId, {
        projectSlug: recipient.payout.project.slug,
        founderId: recipient.payout.project.founderId,
        recipients: [recipient],
        totalCents: Number(recipient.amountCents),
      })
    }
  }

  let transfersProcessed = 0
  let transfersFailed = 0
  let totalAmountCents = 0

  // Process one transfer per project (aggregates all unpaid amounts)
  for (const [, projectData] of recipientsByProject) {
    // Skip if total below Stripe minimum
    if (projectData.totalCents < 50) {
      continue
    }

    // Attempt the transfer for the aggregated amount
    const transferResult = await transferFunds({
      prisma,
      recipientUserId: userId,
      amountCents: projectData.totalCents,
      metadata: {
        projectSlug: projectData.projectSlug,
        recipientCount: String(projectData.recipients.length),
        retroactive: 'true',
      },
    })

    if (transferResult.success) {
      // Mark ALL recipients in this project with the same transfer ID
      const paidAt = new Date()
      await prisma.payoutRecipient.updateMany({
        where: {
          id: { in: projectData.recipients.map((r) => r.id) },
        },
        data: {
          paidAt,
          stripeTransferId: transferResult.transferId,
        },
      })

      // Send notification for each payout covered
      const uniquePayoutIds = [
        ...new Set(projectData.recipients.map((r) => r.payout.id)),
      ]
      for (const payoutId of uniquePayoutIds) {
        await createSystemNotification({
          prisma,
          type: NotificationType.PAYOUT_TRANSFER_SENT,
          referenceType: NotificationReferenceType.PAYOUT,
          referenceId: payoutId,
          recipientId: userId,
        })
      }

      transfersProcessed++
      totalAmountCents += projectData.totalCents
    } else {
      transfersFailed++
      console.error(
        `Failed to process retroactive transfer for project ${projectData.projectSlug}:`,
        transferResult.message,
      )
    }
  }

  return {
    success: true,
    transfersProcessed, // Now counts per-project transfers, not per-recipient
    transfersFailed,
    totalAmountCents,
  }
}

// ================================
// Retry Recipient Transfer
// ================================

interface RetryRecipientTransferParams {
  prisma?: PrismaClientOrTx
  recipientId: string
  userId: string // The user requesting the retry (must be the recipient)
}

type RetryRecipientTransferResult =
  | {
      success: true
      transferId: string
      amountCents: number
    }
  | {
      success: false
      code:
        | 'NOT_FOUND'
        | 'NOT_RECIPIENT'
        | 'ALREADY_PAID'
        | 'PAYOUT_NOT_PAID'
        | 'NO_ACCOUNT'
        | 'NOT_ACTIVE'
        | 'BELOW_MINIMUM'
        | 'TRANSFER_FAILED'
        | 'INSUFFICIENT_FUNDS'
      message: string
    }

/**
 * Retry transfer for a specific payout recipient.
 * This aggregates ALL unpaid recipients for this user in this project,
 * enabling carry-forward of small amounts below Stripe's minimum.
 *
 * Example: User has $0.30 from Jan, $0.25 from Feb, $0.50 from Mar (all unpaid)
 * -> Creates ONE transfer for $1.05
 * -> All 3 PayoutRecipient records are marked with the same stripeTransferId
 */
export async function retryRecipientTransfer({
  prisma = globalPrisma,
  recipientId,
  userId,
}: RetryRecipientTransferParams): Promise<RetryRecipientTransferResult> {
  // Get the recipient with payout and project info
  const recipient = await prisma.payoutRecipient.findUnique({
    where: { id: recipientId },
    select: {
      id: true,
      userId: true,
      amountCents: true,
      paidAt: true,
      stripeTransferId: true,
      payout: {
        select: {
          id: true,
          paymentStatus: true,
          projectId: true,
          project: {
            select: { slug: true, founderId: true },
          },
        },
      },
    },
  })

  if (!recipient) {
    return { success: false, code: 'NOT_FOUND', message: 'Recipient not found' }
  }

  // Verify the requesting user is the recipient
  if (recipient.userId !== userId) {
    return {
      success: false,
      code: 'NOT_RECIPIENT',
      message: 'You can only retry transfers for your own payouts',
    }
  }

  // Check if already paid
  if (recipient.paidAt || recipient.stripeTransferId) {
    return {
      success: false,
      code: 'ALREADY_PAID',
      message: 'This payout has already been transferred',
    }
  }

  // Check if founder has paid for this payout
  if (recipient.payout.paymentStatus !== PayoutPaymentStatus.PAID) {
    return {
      success: false,
      code: 'PAYOUT_NOT_PAID',
      message: 'The founder has not completed payment for this payout yet',
    }
  }

  // Find ALL unpaid recipients for this user in this project (carry-forward aggregation)
  const allUnpaidRecipients = await prisma.payoutRecipient.findMany({
    where: {
      userId,
      paidAt: null,
      stripeTransferId: null,
      payout: {
        projectId: recipient.payout.projectId,
        paymentStatus: PayoutPaymentStatus.PAID, // Only from paid payouts
      },
    },
    select: {
      id: true,
      amountCents: true,
      payout: {
        select: {
          id: true,
          project: { select: { founderId: true } },
        },
      },
    },
  })

  // Calculate total amount across all unpaid recipients
  const totalAmountCents = allUnpaidRecipients.reduce(
    (sum, r) => sum + Number(r.amountCents),
    0,
  )

  // Check minimum amount against the TOTAL (enables carry-forward)
  if (totalAmountCents < 50) {
    return {
      success: false,
      code: 'BELOW_MINIMUM',
      message: `Combined unpaid amount ($${(totalAmountCents / 100).toFixed(2)}) is below Stripe's $0.50 minimum`,
    }
  }

  // Attempt the transfer for the total amount
  const transferResult = await transferFunds({
    prisma,
    recipientUserId: userId,
    amountCents: totalAmountCents,
    metadata: {
      // Note: metadata shows this is aggregated from multiple payouts
      projectSlug: recipient.payout.project.slug,
      recipientCount: String(allUnpaidRecipients.length),
      retroactive: 'true',
    },
  })

  if (!transferResult.success) {
    // Map transfer errors to our error codes
    type ErrorCode = Extract<
      RetryRecipientTransferResult,
      { success: false }
    >['code']
    const codeMap: Record<string, ErrorCode> = {
      NO_ACCOUNT: 'NO_ACCOUNT',
      NOT_ACTIVE: 'NOT_ACTIVE',
      STRIPE_ERROR: 'TRANSFER_FAILED',
      INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
    }

    return {
      success: false,
      code: codeMap[transferResult.code] || 'TRANSFER_FAILED',
      message: transferResult.message,
    }
  }

  // Mark ALL unpaid recipients with the same transfer ID (carry-forward auditability)
  const paidAt = new Date()
  await prisma.payoutRecipient.updateMany({
    where: {
      id: { in: allUnpaidRecipients.map((r) => r.id) },
    },
    data: {
      paidAt,
      stripeTransferId: transferResult.transferId,
    },
  })

  // Send notification for each payout that was covered
  // (deduplicate by payout ID in case same payout has multiple recipients - unlikely but safe)
  const uniquePayoutIds = [
    ...new Set(allUnpaidRecipients.map((r) => r.payout.id)),
  ]
  for (const payoutId of uniquePayoutIds) {
    await createSystemNotification({
      prisma,
      type: NotificationType.PAYOUT_TRANSFER_SENT,
      referenceType: NotificationReferenceType.PAYOUT,
      referenceId: payoutId,
      recipientId: userId,
    })
  }

  return {
    success: true,
    transferId: transferResult.transferId,
    amountCents: totalAmountCents,
  }
}

// ================================
// Webhook Handler
// ================================

/**
 * Stripe event types we handle in webhooks
 * Using discriminated union types for better type safety
 */
type StripeWebhookEvent =
  | Stripe.AccountUpdatedEvent
  | Stripe.CheckoutSessionCompletedEvent
  | Stripe.CheckoutSessionAsyncPaymentSucceededEvent
  | Stripe.CheckoutSessionAsyncPaymentFailedEvent

/**
 * Event type constants extracted from Stripe types
 * These provide type-safe event type strings
 */
const StripeEventType = {
  AccountUpdated:
    'account.updated' as const satisfies Stripe.AccountUpdatedEvent['type'],
  CheckoutSessionCompleted:
    'checkout.session.completed' as const satisfies Stripe.CheckoutSessionCompletedEvent['type'],
  // ACH payments complete asynchronously - these events fire when the bank transfer settles
  CheckoutSessionAsyncPaymentSucceeded:
    'checkout.session.async_payment_succeeded' as const satisfies Stripe.CheckoutSessionAsyncPaymentSucceededEvent['type'],
  CheckoutSessionAsyncPaymentFailed:
    'checkout.session.async_payment_failed' as const satisfies Stripe.CheckoutSessionAsyncPaymentFailedEvent['type'],
} as const

/**
 * Type guard to check if an event is one we handle
 */
function isHandledEvent(event: Stripe.Event): event is StripeWebhookEvent {
  return (
    event.type === StripeEventType.AccountUpdated ||
    event.type === StripeEventType.CheckoutSessionCompleted ||
    event.type === StripeEventType.CheckoutSessionAsyncPaymentSucceeded ||
    event.type === StripeEventType.CheckoutSessionAsyncPaymentFailed
  )
}

export interface HandleWebhookParams {
  prisma?: PrismaClientOrTx
  event: Stripe.Event
}

export interface HandleWebhookResult {
  success: true
  handled: boolean
  eventType: Stripe.Event['type']
}

export type HandleWebhookError = {
  success: false
  code: 'UNHANDLED_EVENT' | 'PROCESSING_ERROR'
  message: string
}

/**
 * Extract useful IDs from a Stripe event for easier querying
 */
function extractEventReferences(event: Stripe.Event): {
  stripeAccountId?: string
  stripeSessionId?: string
  stripePaymentIntent?: string
} {
  // Cast to unknown first to avoid type overlap errors
  const obj = event.data.object as unknown as Record<string, unknown>
  return {
    stripeAccountId:
      event.account ??
      (typeof obj.id === 'string' && obj.id.startsWith('acct_')
        ? obj.id
        : undefined),
    stripeSessionId:
      typeof obj.id === 'string' && obj.id.startsWith('cs_')
        ? obj.id
        : undefined,
    stripePaymentIntent:
      typeof obj.payment_intent === 'string'
        ? obj.payment_intent
        : typeof obj.id === 'string' && obj.id.startsWith('pi_')
          ? obj.id
          : undefined,
  }
}

/**
 * Handle Stripe webhook events
 *
 * All events are stored in the stripe_event table for auditing/replay.
 *
 * Currently handles:
 * - account.updated: Sync account status when Stripe notifies us
 * - checkout.session.completed: Mark payout as paid when founder completes checkout
 */
export async function handleWebhook({
  prisma = globalPrisma,
  event,
}: HandleWebhookParams): Promise<HandleWebhookResult | HandleWebhookError> {
  const eventType = event.type

  // Extract references for easier querying
  const refs = extractEventReferences(event)

  // Store the event first (for audit trail and idempotency)
  let storedEvent
  try {
    storedEvent = await prisma.stripeEvent.upsert({
      where: { stripeEventId: event.id },
      create: {
        stripeEventId: event.id,
        eventType: event.type,
        eventJson: event as unknown as Prisma.InputJsonValue,
        stripeAccountId: refs.stripeAccountId,
        stripeSessionId: refs.stripeSessionId,
        stripePaymentIntent: refs.stripePaymentIntent,
        processed: false,
      },
      update: {
        // If already exists, don't overwrite - this is idempotency
      },
    })

    // If already processed, skip (idempotency)
    if (storedEvent.processed) {
      return { success: true, handled: true, eventType }
    }
  } catch (error) {
    // Log but don't fail - event storage is best-effort
    console.error('Failed to store Stripe event:', error)
  }

  try {
    // Check if this is an event type we handle
    if (!isHandledEvent(event)) {
      // Mark as processed even if not handled
      if (storedEvent) {
        await prisma.stripeEvent.update({
          where: { id: storedEvent.id },
          data: { processed: true, processedAt: new Date() },
        })
      }
      return { success: true, handled: false, eventType }
    }

    // Now TypeScript knows event is StripeWebhookEvent
    switch (event.type) {
      case 'account.updated': {
        // event.data.object is now properly typed as Stripe.Account
        const account = event.data.object

        // Find user by Stripe account ID
        const user = await prisma.user.findFirst({
          where: { stripeConnectAccountId: account.id },
          select: { id: true },
        })

        if (user) {
          // Sync the account status
          const statusResult = await getAccountStatus({
            prisma,
            userId: user.id,
          })

          // If account just became ACTIVE, process any pending payouts
          if (
            statusResult.success &&
            statusResult.account.status === StripeConnectAccountStatus.ACTIVE
          ) {
            const pendingResult = await processPendingTransfersForUser({
              prisma,
              userId: user.id,
            })
            if (pendingResult.success && pendingResult.transfersProcessed > 0) {
              console.log(
                `Processed ${pendingResult.transfersProcessed} pending transfers for user ${user.id}`,
              )
            }
          }

          // Update event with user reference
          if (storedEvent) {
            await prisma.stripeEvent.update({
              where: { id: storedEvent.id },
              data: {
                userId: user.id,
                processed: true,
                processedAt: new Date(),
              },
            })
          }
        } else if (storedEvent) {
          await prisma.stripeEvent.update({
            where: { id: storedEvent.id },
            data: { processed: true, processedAt: new Date() },
          })
        }

        return { success: true, handled: true, eventType }
      }

      case 'checkout.session.completed': {
        // event.data.object is now properly typed as Stripe.Checkout.Session
        const session = event.data.object

        // Check if this is a payout funding session
        if (session.metadata?.type !== 'payout_funding') {
          if (storedEvent) {
            await prisma.stripeEvent.update({
              where: { id: storedEvent.id },
              data: { processed: true, processedAt: new Date() },
            })
          }
          return { success: true, handled: false, eventType }
        }

        // Confirm the payment
        const result = await confirmPayoutPayment({
          prisma,
          sessionId: session.id,
        })

        if (!result.success) {
          console.error('Failed to confirm payout payment:', result.message)
          if (storedEvent) {
            await prisma.stripeEvent.update({
              where: { id: storedEvent.id },
              data: {
                payoutId: session.metadata?.payoutId,
                processed: true,
                processedAt: new Date(),
                error: result.message,
              },
            })
          }
          return { success: true, handled: true, eventType }
        }

        // Process transfers to recipients with active Stripe Connect accounts
        const transferResult = await processPayoutTransfers({
          prisma,
          payoutId: result.payoutId,
        })

        // Log transfer results
        if (transferResult.success) {
          console.log(
            `Processed ${transferResult.summary.total} recipients: ` +
              `${transferResult.summary.paid} paid, ` +
              `${transferResult.summary.failed} failed, ` +
              `${transferResult.summary.skipped} skipped`,
          )
        } else {
          console.error('Failed to process transfers:', transferResult.message)
        }

        // Update event with payout reference
        if (storedEvent) {
          await prisma.stripeEvent.update({
            where: { id: storedEvent.id },
            data: {
              payoutId: result.payoutId,
              processed: true,
              processedAt: new Date(),
            },
          })
        }

        return { success: true, handled: true, eventType }
      }

      case 'checkout.session.async_payment_succeeded': {
        // ACH payment completed successfully (async settlement)
        // This fires when the bank transfer actually settles (3-5 business days)
        const session = event.data.object

        // Only process payout funding sessions
        if (session.metadata?.type !== 'payout_funding') {
          if (storedEvent) {
            await prisma.stripeEvent.update({
              where: { id: storedEvent.id },
              data: { processed: true, processedAt: new Date() },
            })
          }
          return { success: true, handled: false, eventType }
        }

        // Confirm the payment (same flow as checkout.session.completed)
        const result = await confirmPayoutPayment({
          prisma,
          sessionId: session.id,
        })

        if (!result.success) {
          console.error('Failed to confirm ACH payout payment:', result.message)
          if (storedEvent) {
            await prisma.stripeEvent.update({
              where: { id: storedEvent.id },
              data: {
                payoutId: session.metadata?.payoutId,
                processed: true,
                processedAt: new Date(),
                error: result.message,
              },
            })
          }
          return { success: true, handled: true, eventType }
        }

        // Get payout with project info for notification
        const payout = await prisma.payout.findUnique({
          where: { id: result.payoutId },
          select: {
            id: true,
            project: {
              select: { founderId: true },
            },
          },
        })

        // Notify founder that ACH payment cleared
        if (payout) {
          await createSystemNotification({
            prisma,
            type: NotificationType.PAYOUT_PAYMENT_SUCCEEDED,
            referenceType: NotificationReferenceType.PAYOUT,
            referenceId: result.payoutId,
            recipientId: payout.project.founderId,
          })
        }

        // Process transfers to recipients
        const transferResult = await processPayoutTransfers({
          prisma,
          payoutId: result.payoutId,
        })

        if (transferResult.success) {
          console.log(
            `ACH payment confirmed - Processed ${transferResult.summary.total} recipients: ` +
              `${transferResult.summary.paid} paid, ` +
              `${transferResult.summary.failed} failed, ` +
              `${transferResult.summary.skipped} skipped`,
          )
        } else {
          console.error(
            'Failed to process ACH transfers:',
            transferResult.message,
          )
        }

        if (storedEvent) {
          await prisma.stripeEvent.update({
            where: { id: storedEvent.id },
            data: {
              payoutId: result.payoutId,
              processed: true,
              processedAt: new Date(),
            },
          })
        }

        return { success: true, handled: true, eventType }
      }

      case 'checkout.session.async_payment_failed': {
        // ACH payment failed (insufficient funds, account closed, etc.)
        const session = event.data.object

        if (session.metadata?.type !== 'payout_funding') {
          if (storedEvent) {
            await prisma.stripeEvent.update({
              where: { id: storedEvent.id },
              data: { processed: true, processedAt: new Date() },
            })
          }
          return { success: true, handled: false, eventType }
        }

        const payoutId = session.metadata?.payoutId
        if (payoutId) {
          // Get payout with project info for notification
          const payout = await prisma.payout.findUnique({
            where: { id: payoutId },
            select: {
              id: true,
              project: {
                select: { founderId: true },
              },
            },
          })

          // Update payout status to FAILED
          await prisma.payout.update({
            where: { id: payoutId },
            data: {
              paymentStatus: PayoutPaymentStatus.FAILED,
            },
          })

          // Send notification to founder about failed payment
          if (payout) {
            await createSystemNotification({
              prisma,
              type: NotificationType.PAYOUT_PAYMENT_FAILED,
              referenceType: NotificationReferenceType.PAYOUT,
              referenceId: payoutId,
              recipientId: payout.project.founderId,
            })
          }

          console.error(`ACH payment failed for payout ${payoutId}`)
        }

        if (storedEvent) {
          await prisma.stripeEvent.update({
            where: { id: storedEvent.id },
            data: {
              payoutId,
              processed: true,
              processedAt: new Date(),
              error: 'ACH payment failed',
            },
          })
        }

        return { success: true, handled: true, eventType }
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to process webhook'
    console.error(`Failed to handle webhook ${eventType}:`, error)

    // Store the error
    if (storedEvent) {
      await prisma.stripeEvent
        .update({
          where: { id: storedEvent.id },
          data: { error: errorMessage },
        })
        .catch(() => {}) // Don't fail if we can't update
    }

    return {
      success: false,
      code: 'PROCESSING_ERROR',
      message: errorMessage,
    }
  }
}

// ================================
// Check if Stripe is Configured
// ================================

/**
 * Check if Stripe is properly configured
 */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

// ================================
// Create Payout Checkout Session
// ================================

export interface CreatePayoutCheckoutParams {
  prisma?: PrismaClientOrTx
  payoutId: string
  userId: string // Founder initiating payment
  projectSlug: string // For redirect URLs
}

export interface CreatePayoutCheckoutResult {
  success: true
  checkoutUrl: string
  sessionId: string
  breakdown: {
    distributedAmountCents: number
    platformFeeCents: number
    stripeFeeCents: number
    founderTotalCents: number
  }
}

export type CreatePayoutCheckoutError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }
  | { success: false; code: 'ALREADY_PAID'; message: string }
  | { success: false; code: 'STRIPE_ERROR'; message: string }

/**
 * Create a Stripe Checkout session for a founder to pay for a payout
 *
 * Founder pays: Pool amount + Platform fee + Stripe processing fees
 * Contributors receive: Full pool amount
 * Shippy receives: Platform fee
 */
export async function createPayoutCheckout({
  prisma = globalPrisma,
  payoutId,
  userId,
  projectSlug,
}: CreatePayoutCheckoutParams): Promise<
  CreatePayoutCheckoutResult | CreatePayoutCheckoutError
> {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: {
      project: {
        select: { id: true, founderId: true, name: true, slug: true },
      },
    },
  })

  if (!payout) {
    return { success: false, code: 'NOT_FOUND', message: 'Payout not found' }
  }

  if (payout.project.founderId !== userId) {
    return { success: false, code: 'FORBIDDEN', message: 'Access denied' }
  }

  // Check if already paid
  if (
    payout.paymentStatus === PayoutPaymentStatus.PAID ||
    payout.paymentStatus === PayoutPaymentStatus.PROCESSING
  ) {
    return {
      success: false,
      code: 'ALREADY_PAID',
      message: 'Payout has already been paid or is processing',
    }
  }

  // Get founder email
  const founder = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })

  if (!founder) {
    return { success: false, code: 'NOT_FOUND', message: 'Founder not found' }
  }

  // Fees come OUT of the pool (already calculated when payout was created)
  // Founder pays exactly founderTotalCents, fees are deducted from that
  const founderTotalCents = Number(payout.founderTotalCents)
  const stripeFeeCents = Number(payout.stripeFeeCents ?? 0)
  const platformFeeCents = Number(payout.platformFeeCents)
  const distributedAmountCents = Number(payout.distributedAmountCents)

  // Build success/cancel URLs
  const appUrl = getAppUrl()
  const successUrl = `${appUrl}/p/${projectSlug}/payouts/${payoutId}?payment=success`
  const cancelUrl = `${appUrl}/p/${projectSlug}/payouts/${payoutId}?payment=cancel`

  try {
    // Determine allowed payment methods based on amount (tiered fraud prevention)
    const paymentMethodTypes = getPaymentMethodsForAmount(founderTotalCents)

    const session = await stripeOps.createCheckoutSession({
      amountCents: founderTotalCents,
      currency: 'usd',
      customerEmail: founder.email,
      successUrl,
      cancelUrl,
      metadata: {
        payoutId,
        projectId: payout.project.id,
        projectSlug: payout.project.slug,
        periodLabel: payout.periodLabel,
        type: 'payout_funding',
      },
      lineItemDescription: `${payout.project.name} - ${payout.periodLabel} Payout`,
      paymentMethodTypes,
    })

    // Update payout with session info (status only, amounts already set)
    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        paymentStatus: PayoutPaymentStatus.PROCESSING,
        stripeSessionId: session.id,
      },
    })

    return {
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      breakdown: {
        distributedAmountCents,
        platformFeeCents,
        stripeFeeCents,
        founderTotalCents,
      },
    }
  } catch (error) {
    console.error('Failed to create checkout session:', error)
    return {
      success: false,
      code: 'STRIPE_ERROR',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to create checkout session',
    }
  }
}

// ================================
// Confirm Payout Payment
// ================================

export interface ConfirmPayoutPaymentParams {
  prisma?: PrismaClientOrTx
  sessionId: string
}

export interface ConfirmPayoutPaymentResult {
  success: true
  payoutId: string
  paymentIntent: string
  amountCents: number
}

export type ConfirmPayoutPaymentError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'NOT_PAID'; message: string }
  | { success: false; code: 'STRIPE_ERROR'; message: string }

/**
 * Confirm a payout payment after Stripe Checkout completes
 *
 * Called by webhook or on success page load
 */
export async function confirmPayoutPayment({
  prisma = globalPrisma,
  sessionId,
}: ConfirmPayoutPaymentParams): Promise<
  ConfirmPayoutPaymentResult | ConfirmPayoutPaymentError
> {
  // Find the payout by session ID
  const payout = await prisma.payout.findFirst({
    where: { stripeSessionId: sessionId },
    select: { id: true, paymentStatus: true },
  })

  if (!payout) {
    return { success: false, code: 'NOT_FOUND', message: 'Payout not found' }
  }

  // Already confirmed
  if (payout.paymentStatus === PayoutPaymentStatus.PAID) {
    const existingPayout = await prisma.payout.findUnique({
      where: { id: payout.id },
      select: { stripePaymentIntent: true, founderTotalCents: true },
    })
    return {
      success: true,
      payoutId: payout.id,
      paymentIntent: existingPayout?.stripePaymentIntent || '',
      amountCents: Number(existingPayout?.founderTotalCents || 0),
    }
  }

  try {
    // Retrieve session from Stripe
    const session = await stripeOps.retrieveCheckoutSession(sessionId)

    if (session.paymentStatus !== 'paid') {
      return {
        success: false,
        code: 'NOT_PAID',
        message: 'Payment not completed',
      }
    }

    // Update payout status
    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        paymentStatus: PayoutPaymentStatus.PAID,
        stripePaymentIntent: session.paymentIntent,
        paidAt: new Date(),
      },
    })

    return {
      success: true,
      payoutId: payout.id,
      paymentIntent: session.paymentIntent || '',
      amountCents: session.amountTotal || 0,
    }
  } catch (error) {
    console.error('Failed to confirm payout payment:', error)
    return {
      success: false,
      code: 'STRIPE_ERROR',
      message:
        error instanceof Error ? error.message : 'Failed to confirm payment',
    }
  }
}

// ================================
// Get Payout Payment Status
// ================================

export interface GetPayoutPaymentStatusParams {
  prisma?: PrismaClientOrTx
  payoutId: string
  userId: string
}

export interface PayoutPaymentStatusResult {
  success: true
  paymentStatus: PayoutPaymentStatus
  stripeFeeCents: number | null
  founderTotalCents: number | null
  paidAt: Date | null
  canPay: boolean
  canProcessTransfers: boolean
}

export type GetPayoutPaymentStatusError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }

/**
 * Get the payment status for a payout
 */
export async function getPayoutPaymentStatus({
  prisma = globalPrisma,
  payoutId,
  userId,
}: GetPayoutPaymentStatusParams): Promise<
  PayoutPaymentStatusResult | GetPayoutPaymentStatusError
> {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: {
      project: { select: { founderId: true } },
    },
  })

  if (!payout) {
    return { success: false, code: 'NOT_FOUND', message: 'Payout not found' }
  }

  if (payout.project.founderId !== userId) {
    return { success: false, code: 'FORBIDDEN', message: 'Access denied' }
  }

  const paymentStatus = payout.paymentStatus as PayoutPaymentStatus
  const canPay =
    paymentStatus === PayoutPaymentStatus.PENDING ||
    paymentStatus === PayoutPaymentStatus.FAILED
  const canProcessTransfers = paymentStatus === PayoutPaymentStatus.PAID

  return {
    success: true,
    paymentStatus,
    stripeFeeCents: payout.stripeFeeCents
      ? Number(payout.stripeFeeCents)
      : null,
    founderTotalCents: payout.founderTotalCents
      ? Number(payout.founderTotalCents)
      : null,
    paidAt: payout.paidAt,
    canPay,
    canProcessTransfers,
  }
}
