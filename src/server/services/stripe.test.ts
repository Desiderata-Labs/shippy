/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  NotificationReferenceType,
  NotificationType,
  PayoutPaymentStatus,
  StripeConnectAccountStatus,
} from '@/lib/db/types'
import {
  type StripeOperations,
  createConnectAccount,
  getAccountStatus,
  getDashboardLink,
  getOnboardingLink,
  handleWebhook,
  processPayoutTransfers,
  processPendingTransfersForUser,
  resetStripeOperations,
  retryRecipientTransfer,
  setStripeOperations,
  transferFunds,
} from './stripe'
import type Stripe from 'stripe'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Mock the routes module (must be before stripe/server mock)
vi.mock('@/lib/routes', () => ({
  routes: {
    settings: {
      paymentsWithStripe: (status: string) =>
        `/settings/payments?stripe=${status}`,
    },
  },
}))

// Mock the stripe server module
vi.mock('@/lib/stripe/server', () => ({
  getStripeClient: vi.fn(),
  getConnectReturnUrl: vi.fn(
    () => 'https://shippy.sh/settings/payments?stripe=return',
  ),
  getConnectRefreshUrl: vi.fn(
    () => 'https://shippy.sh/settings/payments?stripe=refresh',
  ),
  getAppUrl: vi.fn(() => 'https://shippy.sh'),
}))

// Mock the global prisma client
vi.mock('@/lib/db/server', () => ({
  prisma: {},
}))

// Mock the notification router (uses server-only imports)
vi.mock('@/server/routers/notification', () => ({
  createNotifications: vi.fn().mockResolvedValue(undefined),
  createSystemNotification: vi.fn().mockResolvedValue(undefined),
}))

// ================================
// Mock Factory
// ================================

type MockPrisma = {
  user: {
    findUnique: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  stripeEvent: {
    upsert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
  }
  payout: {
    findUnique: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  payoutRecipient: {
    findUnique: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    updateMany: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
  }
  notification: {
    create: ReturnType<typeof vi.fn>
    createMany: ReturnType<typeof vi.fn>
  }
}

function createMockPrisma(): MockPrisma {
  return {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    stripeEvent: {
      upsert: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    payout: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    payoutRecipient: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
  }
}

function createMockStripeOps(): StripeOperations {
  return {
    createExpressAccount: vi.fn(),
    createAccountLink: vi.fn(),
    retrieveAccount: vi.fn(),
    createTransfer: vi.fn(),
    createLoginLink: vi.fn(),
    createCheckoutSession: vi.fn(),
    retrieveCheckoutSession: vi.fn(),
  }
}

// ================================
// createConnectAccount Tests
// ================================

describe('createConnectAccount', () => {
  let mockPrisma: MockPrisma
  let mockStripeOps: StripeOperations

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    mockStripeOps = createMockStripeOps()
    setStripeOperations(mockStripeOps)
  })

  afterEach(() => {
    resetStripeOperations()
    vi.clearAllMocks()
  })

  test('returns NOT_FOUND when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const result = await createConnectAccount({
      prisma: mockPrisma as any,
      userId: 'non-existent',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_FOUND')
    }
  })

  test('returns ALREADY_EXISTS when user has a Stripe account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      stripeConnectAccountId: 'acct_existing',
    })

    const result = await createConnectAccount({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('ALREADY_EXISTS')
    }
  })

  test('creates account and returns onboarding URL', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      stripeConnectAccountId: null,
    })
    ;(
      mockStripeOps.createExpressAccount as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'acct_new123',
    })
    ;(
      mockStripeOps.createAccountLink as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      url: 'https://connect.stripe.com/setup/...',
      expiresAt: 1234567890,
    })
    mockPrisma.user.update.mockResolvedValue({})

    const result = await createConnectAccount({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.accountId).toBe('acct_new123')
      expect(result.onboardingUrl).toBe('https://connect.stripe.com/setup/...')
    }

    expect(mockStripeOps.createExpressAccount).toHaveBeenCalledWith({
      email: 'test@example.com',
      metadata: {
        userId: 'user-1',
        userName: 'Test User',
        platform: 'shippy',
      },
    })

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        stripeConnectAccountId: 'acct_new123',
        stripeConnectAccountStatus: StripeConnectAccountStatus.PENDING,
      },
    })
  })

  test('returns STRIPE_ERROR when Stripe fails', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      stripeConnectAccountId: null,
    })
    ;(
      mockStripeOps.createExpressAccount as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new Error('Stripe API error'))

    const result = await createConnectAccount({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('STRIPE_ERROR')
      expect(result.message).toBe('Stripe API error')
    }
  })
})

// ================================
// getOnboardingLink Tests
// ================================

describe('getOnboardingLink', () => {
  let mockPrisma: MockPrisma
  let mockStripeOps: StripeOperations

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    mockStripeOps = createMockStripeOps()
    setStripeOperations(mockStripeOps)
  })

  afterEach(() => {
    resetStripeOperations()
    vi.clearAllMocks()
  })

  test('returns NOT_FOUND when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const result = await getOnboardingLink({
      prisma: mockPrisma as any,
      userId: 'non-existent',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_FOUND')
    }
  })

  test('returns NO_ACCOUNT when user has no Stripe account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: null,
      stripeConnectAccountStatus: null,
    })

    const result = await getOnboardingLink({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NO_ACCOUNT')
    }
  })

  test('returns ALREADY_ACTIVE when account is already active', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
    })

    const result = await getOnboardingLink({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('ALREADY_ACTIVE')
    }
  })

  test('returns onboarding link for pending account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.PENDING,
    })
    ;(
      mockStripeOps.createAccountLink as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      url: 'https://connect.stripe.com/setup/...',
      expiresAt: 1234567890,
    })
    mockPrisma.user.update.mockResolvedValue({})

    const result = await getOnboardingLink({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.onboardingUrl).toBe('https://connect.stripe.com/setup/...')
    }

    // Should update status to ONBOARDING
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        stripeConnectAccountStatus: StripeConnectAccountStatus.ONBOARDING,
      },
    })
  })
})

// ================================
// getAccountStatus Tests
// ================================

describe('getAccountStatus', () => {
  let mockPrisma: MockPrisma
  let mockStripeOps: StripeOperations

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    mockStripeOps = createMockStripeOps()
    setStripeOperations(mockStripeOps)
  })

  afterEach(() => {
    resetStripeOperations()
    vi.clearAllMocks()
  })

  test('returns NOT_FOUND when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const result = await getAccountStatus({
      prisma: mockPrisma as any,
      userId: 'non-existent',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_FOUND')
    }
  })

  test('returns no account status when user has no Stripe account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: null,
      stripeConnectAccountStatus: null,
      stripeConnectOnboardedAt: null,
    })

    const result = await getAccountStatus({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.account.hasAccount).toBe(false)
      expect(result.account.status).toBeNull()
    }
  })

  test('syncs status from Stripe for active account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ONBOARDING,
      stripeConnectOnboardedAt: null,
    })
    ;(
      mockStripeOps.retrieveAccount as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'acct_123',
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      requirements: {
        currentlyDue: [],
        eventuallyDue: [],
        pastDue: [],
        disabledReason: null,
      },
    })
    mockPrisma.user.update.mockResolvedValue({})

    const result = await getAccountStatus({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.account.hasAccount).toBe(true)
      expect(result.account.status).toBe(StripeConnectAccountStatus.ACTIVE)
      expect(result.account.chargesEnabled).toBe(true)
      expect(result.account.payoutsEnabled).toBe(true)
      expect(result.account.requiresAction).toBe(false)
    }

    // Should update status and set onboarded timestamp
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
        stripeConnectOnboardedAt: expect.any(Date),
      },
    })
  })

  test('detects restricted account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ONBOARDING,
      stripeConnectOnboardedAt: null,
    })
    ;(
      mockStripeOps.retrieveAccount as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'acct_123',
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: true,
      requirements: {
        currentlyDue: ['verification.document'],
        eventuallyDue: [],
        pastDue: [],
        disabledReason: null,
      },
    })
    mockPrisma.user.update.mockResolvedValue({})

    const result = await getAccountStatus({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.account.status).toBe(StripeConnectAccountStatus.RESTRICTED)
      expect(result.account.requiresAction).toBe(true)
    }
  })

  test('detects disabled account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
      stripeConnectOnboardedAt: new Date(),
    })
    ;(
      mockStripeOps.retrieveAccount as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'acct_123',
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: true,
      requirements: {
        currentlyDue: [],
        eventuallyDue: [],
        pastDue: [],
        disabledReason: 'fraud_detected',
      },
    })
    mockPrisma.user.update.mockResolvedValue({})

    const result = await getAccountStatus({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.account.status).toBe(StripeConnectAccountStatus.DISABLED)
    }
  })
})

// ================================
// getDashboardLink Tests
// ================================

describe('getDashboardLink', () => {
  let mockPrisma: MockPrisma
  let mockStripeOps: StripeOperations

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    mockStripeOps = createMockStripeOps()
    setStripeOperations(mockStripeOps)
  })

  afterEach(() => {
    resetStripeOperations()
    vi.clearAllMocks()
  })

  test('returns NOT_FOUND when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const result = await getDashboardLink({
      prisma: mockPrisma as any,
      userId: 'non-existent',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_FOUND')
    }
  })

  test('returns NO_ACCOUNT when user has no Stripe account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: null,
      stripeConnectAccountStatus: null,
    })

    const result = await getDashboardLink({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NO_ACCOUNT')
    }
  })

  test('returns NOT_ACTIVE when account is not active', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ONBOARDING,
    })

    const result = await getDashboardLink({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_ACTIVE')
    }
  })

  test('returns dashboard URL for active account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
    })
    ;(
      mockStripeOps.createLoginLink as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      url: 'https://connect.stripe.com/express/dashboard/...',
    })

    const result = await getDashboardLink({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.dashboardUrl).toBe(
        'https://connect.stripe.com/express/dashboard/...',
      )
    }
  })
})

// ================================
// transferFunds Tests
// ================================

describe('transferFunds', () => {
  let mockPrisma: MockPrisma
  let mockStripeOps: StripeOperations

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    mockStripeOps = createMockStripeOps()
    setStripeOperations(mockStripeOps)
  })

  afterEach(() => {
    resetStripeOperations()
    vi.clearAllMocks()
  })

  test('returns INVALID_AMOUNT for zero amount', async () => {
    const result = await transferFunds({
      prisma: mockPrisma as any,
      recipientUserId: 'user-1',
      amountCents: 0,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('INVALID_AMOUNT')
    }
  })

  test('returns INVALID_AMOUNT for negative amount', async () => {
    const result = await transferFunds({
      prisma: mockPrisma as any,
      recipientUserId: 'user-1',
      amountCents: -100,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('INVALID_AMOUNT')
    }
  })

  test('returns INVALID_AMOUNT for amount below minimum', async () => {
    const result = await transferFunds({
      prisma: mockPrisma as any,
      recipientUserId: 'user-1',
      amountCents: 25, // Less than $0.50
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('INVALID_AMOUNT')
      expect(result.message).toContain('$0.50')
    }
  })

  test('returns NOT_FOUND when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const result = await transferFunds({
      prisma: mockPrisma as any,
      recipientUserId: 'non-existent',
      amountCents: 1000,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_FOUND')
    }
  })

  test('returns NO_ACCOUNT when user has no Stripe account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: null,
      stripeConnectAccountStatus: null,
    })

    const result = await transferFunds({
      prisma: mockPrisma as any,
      recipientUserId: 'user-1',
      amountCents: 1000,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NO_ACCOUNT')
    }
  })

  test('returns NOT_ACTIVE when account is not active', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ONBOARDING,
    })

    const result = await transferFunds({
      prisma: mockPrisma as any,
      recipientUserId: 'user-1',
      amountCents: 1000,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_ACTIVE')
    }
  })

  test('successfully transfers funds', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
    })
    ;(
      mockStripeOps.createTransfer as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'tr_transfer123',
    })

    const result = await transferFunds({
      prisma: mockPrisma as any,
      recipientUserId: 'user-1',
      amountCents: 1000,
      metadata: {
        payoutId: 'payout-1',
        projectId: 'project-1',
        periodLabel: 'January 2024',
      },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.transferId).toBe('tr_transfer123')
      expect(result.amountCents).toBe(1000)
    }

    expect(mockStripeOps.createTransfer).toHaveBeenCalledWith({
      amount: 1000,
      currency: 'usd',
      destination: 'acct_123',
      metadata: {
        userId: 'user-1',
        platform: 'shippy',
        payoutId: 'payout-1',
        projectId: 'project-1',
        periodLabel: 'January 2024',
      },
    })
  })

  test('returns STRIPE_ERROR when transfer fails', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
    })
    ;(
      mockStripeOps.createTransfer as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new Error('Insufficient funds'))

    const result = await transferFunds({
      prisma: mockPrisma as any,
      recipientUserId: 'user-1',
      amountCents: 1000,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('STRIPE_ERROR')
      expect(result.message).toBe('Insufficient funds')
    }
  })
})

// ================================
// handleWebhook Tests
// ================================

describe('handleWebhook', () => {
  let mockPrisma: MockPrisma
  let mockStripeOps: StripeOperations

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    mockStripeOps = createMockStripeOps()
    setStripeOperations(mockStripeOps)
  })

  afterEach(() => {
    resetStripeOperations()
    vi.clearAllMocks()
  })

  // Helper to create mock Stripe events
  function createMockEvent(
    type: string,
    data: Record<string, unknown>,
    id = 'evt_test123',
  ): Stripe.Event {
    return {
      id,
      type,
      object: 'event',
      api_version: '2025-12-15.clover',
      created: Date.now() / 1000,
      livemode: false,
      pending_webhooks: 0,
      request: null,
      data: {
        object: data as any,
      },
    } as Stripe.Event
  }

  describe('event storage', () => {
    test('stores event before processing', async () => {
      const event = createMockEvent('account.updated', {
        id: 'acct_123',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      })

      mockPrisma.stripeEvent.upsert.mockResolvedValue({
        id: 'se_123',
        stripeEventId: event.id,
        processed: false,
      })
      mockPrisma.user.findFirst.mockResolvedValue(null) // No user found
      mockPrisma.stripeEvent.update.mockResolvedValue({})

      await handleWebhook({ prisma: mockPrisma as any, event })

      expect(mockPrisma.stripeEvent.upsert).toHaveBeenCalledWith({
        where: { stripeEventId: event.id },
        create: expect.objectContaining({
          stripeEventId: event.id,
          eventType: 'account.updated',
          eventJson: event,
          processed: false,
        }),
        update: {},
      })
    })

    test('skips already processed events (idempotency)', async () => {
      const event = createMockEvent('account.updated', {
        id: 'acct_123',
      })

      // Simulate event already processed
      mockPrisma.stripeEvent.upsert.mockResolvedValue({
        id: 'se_123',
        stripeEventId: event.id,
        processed: true, // Already processed
      })

      const result = await handleWebhook({ prisma: mockPrisma as any, event })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.handled).toBe(true)
      }
      // Should not try to process again
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled()
    })

    test('marks event as processed after handling', async () => {
      const event = createMockEvent('account.updated', {
        id: 'acct_123',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      })

      mockPrisma.stripeEvent.upsert.mockResolvedValue({
        id: 'se_123',
        stripeEventId: event.id,
        processed: false,
      })
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
      })
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        stripeConnectAccountId: 'acct_123',
        stripeConnectAccountStatus: StripeConnectAccountStatus.ONBOARDING,
        stripeConnectOnboardedAt: null,
      })
      ;(
        mockStripeOps.retrieveAccount as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'acct_123',
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        requirements: { currentlyDue: [], eventuallyDue: [], pastDue: [] },
      })
      mockPrisma.user.update.mockResolvedValue({})
      mockPrisma.stripeEvent.update.mockResolvedValue({})

      await handleWebhook({ prisma: mockPrisma as any, event })

      // Should update event with userId and mark as processed
      expect(mockPrisma.stripeEvent.update).toHaveBeenCalledWith({
        where: { id: 'se_123' },
        data: expect.objectContaining({
          userId: 'user-1',
          processed: true,
          processedAt: expect.any(Date),
        }),
      })
    })

    test('stores error when processing fails', async () => {
      const event = createMockEvent('account.updated', {
        id: 'acct_123',
      })

      mockPrisma.stripeEvent.upsert.mockResolvedValue({
        id: 'se_123',
        stripeEventId: event.id,
        processed: false,
      })
      mockPrisma.user.findFirst.mockRejectedValue(new Error('Database error'))
      mockPrisma.stripeEvent.update.mockResolvedValue({})

      const result = await handleWebhook({ prisma: mockPrisma as any, event })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('PROCESSING_ERROR')
        expect(result.message).toBe('Database error')
      }

      // Should store the error
      expect(mockPrisma.stripeEvent.update).toHaveBeenCalledWith({
        where: { id: 'se_123' },
        data: { error: 'Database error' },
      })
    })
  })

  describe('account.updated handling', () => {
    test('syncs account status when user found', async () => {
      const event = createMockEvent('account.updated', {
        id: 'acct_123',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      })

      mockPrisma.stripeEvent.upsert.mockResolvedValue({
        id: 'se_123',
        stripeEventId: event.id,
        processed: false,
      })
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' })
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        stripeConnectAccountId: 'acct_123',
        stripeConnectAccountStatus: StripeConnectAccountStatus.ONBOARDING,
        stripeConnectOnboardedAt: null,
      })
      ;(
        mockStripeOps.retrieveAccount as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'acct_123',
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        requirements: { currentlyDue: [], eventuallyDue: [], pastDue: [] },
      })
      mockPrisma.user.update.mockResolvedValue({})
      mockPrisma.stripeEvent.update.mockResolvedValue({})

      const result = await handleWebhook({ prisma: mockPrisma as any, event })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.handled).toBe(true)
        expect(result.eventType).toBe('account.updated')
      }

      // Should have looked up and synced the user
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { stripeConnectAccountId: 'acct_123' },
        select: { id: true },
      })
    })

    test('handles account.updated when no user found', async () => {
      const event = createMockEvent('account.updated', {
        id: 'acct_unknown',
      })

      mockPrisma.stripeEvent.upsert.mockResolvedValue({
        id: 'se_123',
        stripeEventId: event.id,
        processed: false,
      })
      mockPrisma.user.findFirst.mockResolvedValue(null) // No user found
      mockPrisma.stripeEvent.update.mockResolvedValue({})

      const result = await handleWebhook({ prisma: mockPrisma as any, event })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.handled).toBe(true)
      }
    })
  })

  describe('unhandled event types', () => {
    test('returns handled=false for unhandled event types', async () => {
      const event = createMockEvent('customer.created', {
        id: 'cus_123',
      })

      mockPrisma.stripeEvent.upsert.mockResolvedValue({
        id: 'se_123',
        stripeEventId: event.id,
        processed: false,
      })
      mockPrisma.stripeEvent.update.mockResolvedValue({})

      const result = await handleWebhook({ prisma: mockPrisma as any, event })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.handled).toBe(false)
        expect(result.eventType).toBe('customer.created')
      }

      // Should still mark as processed
      expect(mockPrisma.stripeEvent.update).toHaveBeenCalledWith({
        where: { id: 'se_123' },
        data: { processed: true, processedAt: expect.any(Date) },
      })
    })
  })

  describe('checkout.session.completed handling', () => {
    test('ignores non-payout checkout sessions', async () => {
      const event = createMockEvent('checkout.session.completed', {
        id: 'cs_123',
        payment_status: 'paid',
        metadata: { type: 'subscription' }, // Not a payout session
      })

      mockPrisma.stripeEvent.upsert.mockResolvedValue({
        id: 'se_123',
        stripeEventId: event.id,
        processed: false,
      })
      mockPrisma.stripeEvent.update.mockResolvedValue({})

      const result = await handleWebhook({ prisma: mockPrisma as any, event })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.handled).toBe(false) // Not handled because not a payout session
      }
    })
  })

  describe('checkout.session.async_payment_succeeded handling (ACH)', () => {
    test('ignores non-payout ACH sessions', async () => {
      const event = createMockEvent(
        'checkout.session.async_payment_succeeded',
        {
          id: 'cs_ach_123',
          payment_status: 'paid',
          metadata: { type: 'subscription' }, // Not a payout session
        },
      )

      mockPrisma.stripeEvent.upsert.mockResolvedValue({
        id: 'se_123',
        stripeEventId: event.id,
        processed: false,
      })
      mockPrisma.stripeEvent.update.mockResolvedValue({})

      const result = await handleWebhook({ prisma: mockPrisma as any, event })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.handled).toBe(false)
      }
    })

    test('processes ACH payment for payout funding', async () => {
      const event = createMockEvent(
        'checkout.session.async_payment_succeeded',
        {
          id: 'cs_ach_123',
          payment_status: 'paid',
          payment_intent: 'pi_123',
          amount_total: 10000,
          metadata: {
            type: 'payout_funding',
            payoutId: 'payout-1',
          },
        },
      )

      mockPrisma.stripeEvent.upsert.mockResolvedValue({
        id: 'se_123',
        stripeEventId: event.id,
        processed: false,
      })
      mockPrisma.stripeEvent.update.mockResolvedValue({})

      // Mock payout lookup for confirmPayoutPayment
      mockPrisma.payout.findFirst.mockResolvedValue({
        id: 'payout-1',
        paymentStatus: PayoutPaymentStatus.PROCESSING,
      })
      mockPrisma.payout.update.mockResolvedValue({})

      // Mock payout lookup for processPayoutTransfers
      mockPrisma.payout.findUnique.mockResolvedValue({
        id: 'payout-1',
        paymentStatus: PayoutPaymentStatus.PAID,
        project: {
          id: 'proj-1',
          slug: 'test',
          name: 'Test',
          founderId: 'founder-1',
        },
        recipients: [],
      })

      // Mock Stripe session retrieval
      ;(
        mockStripeOps.retrieveCheckoutSession as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'cs_ach_123',
        paymentStatus: 'paid',
        paymentIntent: 'pi_123',
        amountTotal: 10000,
      })

      const result = await handleWebhook({ prisma: mockPrisma as any, event })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.handled).toBe(true)
        expect(result.eventType).toBe(
          'checkout.session.async_payment_succeeded',
        )
      }

      // Should have updated the payout
      expect(mockPrisma.payout.update).toHaveBeenCalled()
    })
  })

  describe('checkout.session.async_payment_failed handling (ACH)', () => {
    test('ignores non-payout ACH sessions', async () => {
      const event = createMockEvent('checkout.session.async_payment_failed', {
        id: 'cs_ach_fail_123',
        metadata: { type: 'subscription' },
      })

      mockPrisma.stripeEvent.upsert.mockResolvedValue({
        id: 'se_123',
        stripeEventId: event.id,
        processed: false,
      })
      mockPrisma.stripeEvent.update.mockResolvedValue({})

      const result = await handleWebhook({ prisma: mockPrisma as any, event })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.handled).toBe(false)
      }
    })

    test('marks payout as FAILED and sends notification to founder', async () => {
      // Import the mocked function to check if it was called
      const { createSystemNotification } =
        await import('@/server/routers/notification')

      const event = createMockEvent('checkout.session.async_payment_failed', {
        id: 'cs_ach_fail_123',
        metadata: {
          type: 'payout_funding',
          payoutId: 'payout-1',
        },
      })

      mockPrisma.stripeEvent.upsert.mockResolvedValue({
        id: 'se_123',
        stripeEventId: event.id,
        processed: false,
      })
      mockPrisma.stripeEvent.update.mockResolvedValue({})

      // Mock payout lookup
      mockPrisma.payout.findUnique.mockResolvedValue({
        id: 'payout-1',
        project: { founderId: 'founder-1' },
      })
      mockPrisma.payout.update.mockResolvedValue({})

      const result = await handleWebhook({ prisma: mockPrisma as any, event })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.handled).toBe(true)
        expect(result.eventType).toBe('checkout.session.async_payment_failed')
      }

      // Should have updated payout status to FAILED
      expect(mockPrisma.payout.update).toHaveBeenCalledWith({
        where: { id: 'payout-1' },
        data: { paymentStatus: PayoutPaymentStatus.FAILED },
      })

      // Should have sent a system notification to the founder
      expect(createSystemNotification).toHaveBeenCalledWith({
        prisma: mockPrisma,
        type: NotificationType.PAYOUT_PAYMENT_FAILED,
        referenceType: NotificationReferenceType.PAYOUT,
        referenceId: 'payout-1',
        recipientId: 'founder-1',
      })

      // Should have stored the error in the event
      expect(mockPrisma.stripeEvent.update).toHaveBeenCalledWith({
        where: { id: 'se_123' },
        data: expect.objectContaining({
          payoutId: 'payout-1',
          error: 'ACH payment failed',
        }),
      })
    })

    test('handles missing payoutId gracefully', async () => {
      const event = createMockEvent('checkout.session.async_payment_failed', {
        id: 'cs_ach_fail_123',
        metadata: {
          type: 'payout_funding',
          // No payoutId
        },
      })

      mockPrisma.stripeEvent.upsert.mockResolvedValue({
        id: 'se_123',
        stripeEventId: event.id,
        processed: false,
      })
      mockPrisma.stripeEvent.update.mockResolvedValue({})

      const result = await handleWebhook({ prisma: mockPrisma as any, event })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.handled).toBe(true)
      }

      // Should not have tried to update a payout
      expect(mockPrisma.payout.update).not.toHaveBeenCalled()
    })
  })

  describe('event reference extraction', () => {
    test('extracts stripeAccountId from Connect event', async () => {
      const event = createMockEvent(
        'account.updated',
        { id: 'acct_123' },
        'evt_test_connect',
      )
      // Add account field for Connect events
      ;(event as any).account = 'acct_456'

      mockPrisma.stripeEvent.upsert.mockResolvedValue({
        id: 'se_123',
        stripeEventId: event.id,
        processed: false,
      })
      mockPrisma.user.findFirst.mockResolvedValue(null)
      mockPrisma.stripeEvent.update.mockResolvedValue({})

      await handleWebhook({ prisma: mockPrisma as any, event })

      expect(mockPrisma.stripeEvent.upsert).toHaveBeenCalledWith({
        where: { stripeEventId: event.id },
        create: expect.objectContaining({
          stripeAccountId: 'acct_456',
        }),
        update: {},
      })
    })

    test('extracts stripeSessionId from checkout event', async () => {
      const event = createMockEvent('checkout.session.completed', {
        id: 'cs_test123',
        payment_status: 'paid',
        metadata: {},
      })

      mockPrisma.stripeEvent.upsert.mockResolvedValue({
        id: 'se_123',
        stripeEventId: event.id,
        processed: false,
      })
      mockPrisma.stripeEvent.update.mockResolvedValue({})

      await handleWebhook({ prisma: mockPrisma as any, event })

      expect(mockPrisma.stripeEvent.upsert).toHaveBeenCalledWith({
        where: { stripeEventId: event.id },
        create: expect.objectContaining({
          stripeSessionId: 'cs_test123',
        }),
        update: {},
      })
    })
  })
})

// ================================
// processPayoutTransfers Tests
// ================================

describe('processPayoutTransfers', () => {
  let mockPrisma: MockPrisma
  let mockStripeOps: StripeOperations

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    mockStripeOps = createMockStripeOps()
    setStripeOperations(mockStripeOps)
  })

  afterEach(() => {
    resetStripeOperations()
    vi.clearAllMocks()
  })

  test('returns NOT_FOUND when payout does not exist', async () => {
    mockPrisma.payout.findUnique.mockResolvedValue(null)

    const result = await processPayoutTransfers({
      prisma: mockPrisma as any,
      payoutId: 'non-existent',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_FOUND')
    }
  })

  test('returns NOT_PAID when founder has not paid yet', async () => {
    mockPrisma.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      paymentStatus: PayoutPaymentStatus.PENDING,
      project: { id: 'proj-1', slug: 'test', name: 'Test' },
      recipients: [],
    })

    const result = await processPayoutTransfers({
      prisma: mockPrisma as any,
      payoutId: 'payout-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_PAID')
    }
  })

  test('skips recipients who are already paid', async () => {
    mockPrisma.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      paymentStatus: PayoutPaymentStatus.PAID,
      project: { id: 'proj-1', slug: 'test', name: 'Test' },
      recipients: [
        {
          id: 'rec-1',
          amountCents: BigInt(1000),
          paidAt: new Date(),
          stripeTransferId: 'tr_existing',
          user: {
            id: 'user-1',
            username: 'contributor1',
            stripeConnectAccountId: 'acct_123',
            stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
          },
        },
      ],
    })

    const result = await processPayoutTransfers({
      prisma: mockPrisma as any,
      payoutId: 'payout-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.summary.paid).toBe(1)
      expect(result.summary.skipped).toBe(0)
      expect(result.results[0].transferId).toBe('tr_existing')
    }

    // Should not have called createTransfer
    expect(mockStripeOps.createTransfer).not.toHaveBeenCalled()
  })

  test('skips recipients without Stripe Connect account', async () => {
    mockPrisma.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      paymentStatus: PayoutPaymentStatus.PAID,
      project: { id: 'proj-1', slug: 'test', name: 'Test' },
      recipients: [
        {
          id: 'rec-1',
          amountCents: BigInt(1000),
          paidAt: null,
          stripeTransferId: null,
          user: {
            id: 'user-1',
            username: 'contributor1',
            stripeConnectAccountId: null,
            stripeConnectAccountStatus: null,
          },
        },
      ],
    })

    const result = await processPayoutTransfers({
      prisma: mockPrisma as any,
      payoutId: 'payout-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.summary.paid).toBe(0)
      expect(result.summary.skipped).toBe(1)
      expect(result.results[0].reason).toBe('NO_ACCOUNT')
    }
  })

  test('skips recipients with inactive Stripe account', async () => {
    mockPrisma.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      paymentStatus: PayoutPaymentStatus.PAID,
      project: { id: 'proj-1', slug: 'test', name: 'Test' },
      recipients: [
        {
          id: 'rec-1',
          amountCents: BigInt(1000),
          paidAt: null,
          stripeTransferId: null,
          user: {
            id: 'user-1',
            username: 'contributor1',
            stripeConnectAccountId: 'acct_123',
            stripeConnectAccountStatus: StripeConnectAccountStatus.ONBOARDING,
          },
        },
      ],
    })

    const result = await processPayoutTransfers({
      prisma: mockPrisma as any,
      payoutId: 'payout-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.summary.paid).toBe(0)
      expect(result.summary.skipped).toBe(1)
      expect(result.results[0].reason).toBe('NOT_ACTIVE')
    }
  })

  test('skips recipients with amount below Stripe minimum', async () => {
    mockPrisma.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      paymentStatus: PayoutPaymentStatus.PAID,
      project: { id: 'proj-1', slug: 'test', name: 'Test' },
      recipients: [
        {
          id: 'rec-1',
          amountCents: BigInt(25), // Below $0.50 minimum
          paidAt: null,
          stripeTransferId: null,
          user: {
            id: 'user-1',
            username: 'contributor1',
            stripeConnectAccountId: 'acct_123',
            stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
          },
        },
      ],
    })

    const result = await processPayoutTransfers({
      prisma: mockPrisma as any,
      payoutId: 'payout-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.summary.paid).toBe(0)
      expect(result.summary.skipped).toBe(1)
      expect(result.results[0].reason).toBe('BELOW_MINIMUM')
    }
  })

  test('successfully transfers to eligible recipients', async () => {
    mockPrisma.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      paymentStatus: PayoutPaymentStatus.PAID,
      project: { id: 'proj-1', slug: 'test', name: 'Test' },
      recipients: [
        {
          id: 'rec-1',
          amountCents: BigInt(1000),
          paidAt: null,
          stripeTransferId: null,
          user: {
            id: 'user-1',
            username: 'contributor1',
            stripeConnectAccountId: 'acct_123',
            stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
          },
        },
      ],
    })

    // Mock user lookup for transferFunds
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
    })

    // Mock successful transfer
    ;(
      mockStripeOps.createTransfer as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'tr_new123',
    })

    mockPrisma.payoutRecipient.update.mockResolvedValue({})

    const result = await processPayoutTransfers({
      prisma: mockPrisma as any,
      payoutId: 'payout-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.summary.paid).toBe(1)
      expect(result.summary.failed).toBe(0)
      expect(result.results[0].transferId).toBe('tr_new123')
    }

    // Verify recipient was updated
    expect(mockPrisma.payoutRecipient.update).toHaveBeenCalledWith({
      where: { id: 'rec-1' },
      data: {
        paidAt: expect.any(Date),
        stripeTransferId: 'tr_new123',
      },
    })
  })

  test('handles transfer failure gracefully', async () => {
    mockPrisma.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      paymentStatus: PayoutPaymentStatus.PAID,
      project: { id: 'proj-1', slug: 'test', name: 'Test' },
      recipients: [
        {
          id: 'rec-1',
          amountCents: BigInt(1000),
          paidAt: null,
          stripeTransferId: null,
          user: {
            id: 'user-1',
            username: 'contributor1',
            stripeConnectAccountId: 'acct_123',
            stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
          },
        },
      ],
    })

    // Mock user lookup
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
    })

    // Mock transfer failure
    ;(
      mockStripeOps.createTransfer as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new Error('Stripe API error'))

    const result = await processPayoutTransfers({
      prisma: mockPrisma as any,
      payoutId: 'payout-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.summary.paid).toBe(0)
      expect(result.summary.failed).toBe(1)
      expect(result.results[0].reason).toBe('TRANSFER_FAILED')
      expect(result.results[0].error).toContain('Stripe API error')
    }

    // Should not have updated recipient
    expect(mockPrisma.payoutRecipient.update).not.toHaveBeenCalled()
  })

  test('processes mixed recipients correctly', async () => {
    mockPrisma.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      paymentStatus: PayoutPaymentStatus.PAID,
      project: { id: 'proj-1', slug: 'test', name: 'Test' },
      recipients: [
        // Already paid
        {
          id: 'rec-1',
          amountCents: BigInt(1000),
          paidAt: new Date(),
          stripeTransferId: 'tr_existing',
          user: {
            id: 'user-1',
            username: 'paid_user',
            stripeConnectAccountId: 'acct_1',
            stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
          },
        },
        // No Stripe account
        {
          id: 'rec-2',
          amountCents: BigInt(2000),
          paidAt: null,
          stripeTransferId: null,
          user: {
            id: 'user-2',
            username: 'no_stripe',
            stripeConnectAccountId: null,
            stripeConnectAccountStatus: null,
          },
        },
        // Eligible for transfer
        {
          id: 'rec-3',
          amountCents: BigInt(3000),
          paidAt: null,
          stripeTransferId: null,
          user: {
            id: 'user-3',
            username: 'eligible',
            stripeConnectAccountId: 'acct_3',
            stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
          },
        },
      ],
    })

    // Mock user lookup for eligible user
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-3',
      stripeConnectAccountId: 'acct_3',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
    })
    ;(
      mockStripeOps.createTransfer as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'tr_new',
    })
    mockPrisma.payoutRecipient.update.mockResolvedValue({})

    const result = await processPayoutTransfers({
      prisma: mockPrisma as any,
      payoutId: 'payout-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.summary.total).toBe(3)
      expect(result.summary.paid).toBe(2) // 1 already paid + 1 new transfer
      expect(result.summary.skipped).toBe(1) // No Stripe account
      expect(result.summary.failed).toBe(0)
    }
  })

  // NOTE: Payout status update tests removed - we no longer update payout.status
  // Stripe payment status (paymentStatus) and individual recipient.paidAt now track payments

  test('processes recipients and marks them as paid', async () => {
    mockPrisma.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      paymentStatus: PayoutPaymentStatus.PAID,
      project: {
        id: 'proj-1',
        slug: 'test',
        name: 'Test',
        founderId: 'founder-1',
      },
      recipients: [
        {
          id: 'rec-1',
          amountCents: BigInt(1000),
          paidAt: null,
          stripeTransferId: null,
          user: {
            id: 'user-1',
            username: 'contributor1',
            stripeConnectAccountId: 'acct_123',
            stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
          },
        },
      ],
    })

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
    })
    ;(
      mockStripeOps.createTransfer as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'tr_123',
    })

    mockPrisma.payoutRecipient.update.mockResolvedValue({})

    const result = await processPayoutTransfers({
      prisma: mockPrisma as any,
      payoutId: 'payout-1',
    })

    expect(result.success).toBe(true)
    // Verify recipient was marked as paid with transfer ID
    expect(mockPrisma.payoutRecipient.update).toHaveBeenCalled()
  })
})

// ================================
// processPendingTransfersForUser Tests
// ================================

describe('processPendingTransfersForUser', () => {
  let mockPrisma: MockPrisma
  let mockStripeOps: StripeOperations

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    mockStripeOps = createMockStripeOps()
    setStripeOperations(mockStripeOps)
  })

  afterEach(() => {
    resetStripeOperations()
    vi.clearAllMocks()
  })

  test('returns NOT_FOUND when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const result = await processPendingTransfersForUser({
      prisma: mockPrisma as any,
      userId: 'non-existent',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_FOUND')
    }
  })

  test('returns NOT_ACTIVE when user has no Stripe account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: null,
      stripeConnectAccountStatus: null,
    })

    const result = await processPendingTransfersForUser({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_ACTIVE')
    }
  })

  test('returns NOT_ACTIVE when user account is not active', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ONBOARDING,
    })

    const result = await processPendingTransfersForUser({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_ACTIVE')
    }
  })

  test('returns success with zero transfers when no pending recipients', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
    })
    mockPrisma.payoutRecipient.findMany.mockResolvedValue([])

    const result = await processPendingTransfersForUser({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.transfersProcessed).toBe(0)
      expect(result.transfersFailed).toBe(0)
      expect(result.totalAmountCents).toBe(0)
    }
  })

  test('aggregates multiple payouts from same project into one transfer (carry-forward)', async () => {
    // First call for processPendingTransfersForUser
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'user-1',
        stripeConnectAccountId: 'acct_123',
        stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
      })
      // Second call for transferFunds
      .mockResolvedValue({
        id: 'user-1',
        stripeConnectAccountId: 'acct_123',
        stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
      })

    // Two payouts from the SAME project should be aggregated
    mockPrisma.payoutRecipient.findMany.mockResolvedValue([
      {
        id: 'rec-1',
        amountCents: BigInt(1000),
        payout: {
          id: 'payout-1',
          projectId: 'project-1',
          project: { slug: 'test-project', founderId: 'founder-1' },
        },
      },
      {
        id: 'rec-2',
        amountCents: BigInt(2000),
        payout: {
          id: 'payout-2',
          projectId: 'project-1', // Same project
          project: { slug: 'test-project', founderId: 'founder-1' },
        },
      },
    ])
    ;(
      mockStripeOps.createTransfer as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: 'tr_aggregated' })

    mockPrisma.payoutRecipient.updateMany.mockResolvedValue({ count: 2 })

    const result = await processPendingTransfersForUser({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      // Should be 1 transfer (aggregated), not 2
      expect(result.transfersProcessed).toBe(1)
      expect(result.transfersFailed).toBe(0)
      expect(result.totalAmountCents).toBe(3000) // $10 + $20 = $30
    }

    // Should create ONE transfer for the aggregated amount
    expect(mockStripeOps.createTransfer).toHaveBeenCalledTimes(1)
    expect(mockStripeOps.createTransfer).toHaveBeenCalledWith({
      amount: 3000,
      currency: 'usd',
      destination: 'acct_123',
      metadata: expect.objectContaining({
        projectSlug: 'test-project',
        recipientCount: '2',
        retroactive: 'true',
      }),
    })

    // Should update ALL recipients with the same transfer ID (updateMany)
    expect(mockPrisma.payoutRecipient.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['rec-1', 'rec-2'] } },
      data: {
        paidAt: expect.any(Date),
        stripeTransferId: 'tr_aggregated',
      },
    })
  })

  test('creates separate transfers for different projects', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
    })

    // Two payouts from DIFFERENT projects should get separate transfers
    mockPrisma.payoutRecipient.findMany.mockResolvedValue([
      {
        id: 'rec-1',
        amountCents: BigInt(1000),
        payout: {
          id: 'payout-1',
          projectId: 'project-1',
          project: { slug: 'project-one', founderId: 'founder-1' },
        },
      },
      {
        id: 'rec-2',
        amountCents: BigInt(2000),
        payout: {
          id: 'payout-2',
          projectId: 'project-2', // Different project
          project: { slug: 'project-two', founderId: 'founder-2' },
        },
      },
    ])
    ;(mockStripeOps.createTransfer as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'tr_1' })
      .mockResolvedValueOnce({ id: 'tr_2' })

    mockPrisma.payoutRecipient.updateMany.mockResolvedValue({ count: 1 })

    const result = await processPendingTransfersForUser({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      // Should be 2 transfers (one per project)
      expect(result.transfersProcessed).toBe(2)
      expect(result.totalAmountCents).toBe(3000)
    }

    // Should create TWO transfers
    expect(mockStripeOps.createTransfer).toHaveBeenCalledTimes(2)
  })

  test('skips project if aggregated total is below Stripe minimum', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
    })

    // Even with multiple recipients, if total < $0.50, skip
    mockPrisma.payoutRecipient.findMany.mockResolvedValue([
      {
        id: 'rec-1',
        amountCents: BigInt(20), // $0.20
        payout: {
          id: 'payout-1',
          projectId: 'project-1',
          project: { slug: 'test-project', founderId: 'founder-1' },
        },
      },
      {
        id: 'rec-2',
        amountCents: BigInt(25), // $0.25
        payout: {
          id: 'payout-2',
          projectId: 'project-1',
          project: { slug: 'test-project', founderId: 'founder-1' },
        },
      },
    ])
    // Total = $0.45, still below $0.50 minimum

    const result = await processPendingTransfersForUser({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.transfersProcessed).toBe(0)
      expect(result.transfersFailed).toBe(0)
    }

    // Should not have called createTransfer
    expect(mockStripeOps.createTransfer).not.toHaveBeenCalled()
  })

  test('aggregates small amounts that together meet minimum (carry-forward)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
    })

    // Each recipient below minimum, but together they meet it
    mockPrisma.payoutRecipient.findMany.mockResolvedValue([
      {
        id: 'rec-1',
        amountCents: BigInt(30), // $0.30
        payout: {
          id: 'payout-1',
          projectId: 'project-1',
          project: { slug: 'test-project', founderId: 'founder-1' },
        },
      },
      {
        id: 'rec-2',
        amountCents: BigInt(25), // $0.25
        payout: {
          id: 'payout-2',
          projectId: 'project-1',
          project: { slug: 'test-project', founderId: 'founder-1' },
        },
      },
    ])
    // Total = $0.55, above $0.50 minimum!
    ;(
      mockStripeOps.createTransfer as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: 'tr_combined' })

    mockPrisma.payoutRecipient.updateMany.mockResolvedValue({ count: 2 })

    const result = await processPendingTransfersForUser({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.transfersProcessed).toBe(1)
      expect(result.totalAmountCents).toBe(55)
    }

    // Should create a transfer for the combined amount
    expect(mockStripeOps.createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 55,
      }),
    )
  })

  test('handles transfer failures gracefully', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
    })

    mockPrisma.payoutRecipient.findMany.mockResolvedValue([
      {
        id: 'rec-1',
        amountCents: BigInt(1000),
        payout: {
          id: 'payout-1',
          projectId: 'project-1',
          project: { slug: 'test-project', founderId: 'founder-1' },
        },
      },
    ])
    ;(
      mockStripeOps.createTransfer as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new Error('Stripe API error'))

    const result = await processPendingTransfersForUser({
      prisma: mockPrisma as any,
      userId: 'user-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.transfersProcessed).toBe(0)
      expect(result.transfersFailed).toBe(1)
    }

    // Should not have updated recipients
    expect(mockPrisma.payoutRecipient.updateMany).not.toHaveBeenCalled()
  })

  // NOTE: Payout status update test removed - we no longer update payout.status
  // Stripe paymentStatus and individual recipient.paidAt now track payments
})

// ================================
// retryRecipientTransfer Tests
// ================================

describe('retryRecipientTransfer', () => {
  let mockPrisma: MockPrisma
  let mockStripeOps: StripeOperations

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    mockStripeOps = createMockStripeOps()
    setStripeOperations(mockStripeOps)
  })

  afterEach(() => {
    resetStripeOperations()
    vi.clearAllMocks()
  })

  test('returns NOT_FOUND if recipient does not exist', async () => {
    mockPrisma.payoutRecipient.findUnique.mockResolvedValue(null)

    const result = await retryRecipientTransfer({
      prisma: mockPrisma as any,
      recipientId: 'rec-nonexistent',
      userId: 'user-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_FOUND')
    }
  })

  test('returns NOT_RECIPIENT if user is not the recipient', async () => {
    mockPrisma.payoutRecipient.findUnique.mockResolvedValue({
      id: 'rec-1',
      userId: 'other-user', // Different user
      amountCents: BigInt(1000),
      paidAt: null,
      stripeTransferId: null,
      payout: {
        id: 'payout-1',
        paymentStatus: PayoutPaymentStatus.PAID,
        projectId: 'project-1',
        project: { slug: 'test', founderId: 'founder-1' },
      },
    })

    const result = await retryRecipientTransfer({
      prisma: mockPrisma as any,
      recipientId: 'rec-1',
      userId: 'user-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_RECIPIENT')
    }
  })

  test('returns ALREADY_PAID if recipient already has transfer', async () => {
    mockPrisma.payoutRecipient.findUnique.mockResolvedValue({
      id: 'rec-1',
      userId: 'user-1',
      amountCents: BigInt(1000),
      paidAt: new Date(),
      stripeTransferId: 'tr_existing',
      payout: {
        id: 'payout-1',
        paymentStatus: PayoutPaymentStatus.PAID,
        projectId: 'project-1',
        project: { slug: 'test', founderId: 'founder-1' },
      },
    })

    const result = await retryRecipientTransfer({
      prisma: mockPrisma as any,
      recipientId: 'rec-1',
      userId: 'user-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('ALREADY_PAID')
    }
  })

  test('returns PAYOUT_NOT_PAID if founder has not paid', async () => {
    mockPrisma.payoutRecipient.findUnique.mockResolvedValue({
      id: 'rec-1',
      userId: 'user-1',
      amountCents: BigInt(1000),
      paidAt: null,
      stripeTransferId: null,
      payout: {
        id: 'payout-1',
        paymentStatus: PayoutPaymentStatus.PENDING, // Not paid yet
        projectId: 'project-1',
        project: { slug: 'test', founderId: 'founder-1' },
      },
    })

    const result = await retryRecipientTransfer({
      prisma: mockPrisma as any,
      recipientId: 'rec-1',
      userId: 'user-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('PAYOUT_NOT_PAID')
    }
  })

  test('aggregates all unpaid recipients in same project (carry-forward)', async () => {
    // Initial recipient lookup
    mockPrisma.payoutRecipient.findUnique.mockResolvedValue({
      id: 'rec-1',
      userId: 'user-1',
      amountCents: BigInt(30), // $0.30 - below minimum alone
      paidAt: null,
      stripeTransferId: null,
      payout: {
        id: 'payout-1',
        paymentStatus: PayoutPaymentStatus.PAID,
        projectId: 'project-1',
        project: { slug: 'test-project', founderId: 'founder-1' },
      },
    })

    // Find ALL unpaid recipients in the project
    mockPrisma.payoutRecipient.findMany.mockResolvedValue([
      {
        id: 'rec-1',
        amountCents: BigInt(30), // $0.30
        payout: { id: 'payout-1', project: { founderId: 'founder-1' } },
      },
      {
        id: 'rec-2',
        amountCents: BigInt(25), // $0.25
        payout: { id: 'payout-2', project: { founderId: 'founder-1' } },
      },
    ])
    // Total = $0.55, above minimum!

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      stripeConnectAccountId: 'acct_123',
      stripeConnectAccountStatus: StripeConnectAccountStatus.ACTIVE,
    })
    ;(
      mockStripeOps.createTransfer as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: 'tr_aggregated' })

    mockPrisma.payoutRecipient.updateMany.mockResolvedValue({ count: 2 })

    const result = await retryRecipientTransfer({
      prisma: mockPrisma as any,
      recipientId: 'rec-1',
      userId: 'user-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.transferId).toBe('tr_aggregated')
      expect(result.amountCents).toBe(55) // Aggregated amount
    }

    // Should create ONE transfer for aggregated amount
    expect(mockStripeOps.createTransfer).toHaveBeenCalledWith({
      amount: 55,
      currency: 'usd',
      destination: 'acct_123',
      metadata: expect.objectContaining({
        projectSlug: 'test-project',
        recipientCount: '2',
        retroactive: 'true',
      }),
    })

    // Should update ALL recipients with the same transfer ID
    expect(mockPrisma.payoutRecipient.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['rec-1', 'rec-2'] } },
      data: {
        paidAt: expect.any(Date),
        stripeTransferId: 'tr_aggregated',
      },
    })
  })

  test('returns BELOW_MINIMUM if aggregated total still too low', async () => {
    mockPrisma.payoutRecipient.findUnique.mockResolvedValue({
      id: 'rec-1',
      userId: 'user-1',
      amountCents: BigInt(20),
      paidAt: null,
      stripeTransferId: null,
      payout: {
        id: 'payout-1',
        paymentStatus: PayoutPaymentStatus.PAID,
        projectId: 'project-1',
        project: { slug: 'test', founderId: 'founder-1' },
      },
    })

    // Only one small recipient, total still below minimum
    mockPrisma.payoutRecipient.findMany.mockResolvedValue([
      {
        id: 'rec-1',
        amountCents: BigInt(20), // $0.20
        payout: { id: 'payout-1', project: { founderId: 'founder-1' } },
      },
    ])

    const result = await retryRecipientTransfer({
      prisma: mockPrisma as any,
      recipientId: 'rec-1',
      userId: 'user-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('BELOW_MINIMUM')
      expect(result.message).toContain('$0.20')
    }
  })
})
