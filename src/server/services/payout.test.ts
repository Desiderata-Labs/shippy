/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  type ContributorPoints,
  calculatePayout,
  createPayout,
  getContributorPoints,
} from './payout'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock the notification module
vi.mock('@/server/routers/notification', () => ({
  createNotifications: vi.fn().mockResolvedValue(undefined),
}))

// Mock the global prisma client used for notifications
vi.mock('@/lib/db/server', () => ({
  prisma: {},
}))

// Mock the stripe service (to avoid importing server-only modules)
vi.mock('@/server/services/stripe', () => ({
  transferFunds: vi
    .fn()
    .mockResolvedValue({ success: true, transferId: 'tr_test' }),
}))

// ================================
// Mock Factory
// ================================

type MockPrisma = {
  project: {
    findUnique: ReturnType<typeof vi.fn>
  }
  submission: {
    findMany: ReturnType<typeof vi.fn>
  }
  payout: {
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  payoutRecipient: {
    findUnique: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    updateMany: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
  }
}

function createMockPrisma(): MockPrisma {
  return {
    project: {
      findUnique: vi.fn(),
    },
    submission: {
      findMany: vi.fn(),
    },
    payout: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    payoutRecipient: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  }
}

// ================================
// getContributorPoints Tests
// ================================

describe('getContributorPoints', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  test('aggregates points by user from approved submissions', async () => {
    mockPrisma.submission.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        pointsAwarded: 100,
        user: { id: 'user-1', name: 'Alice', image: 'alice.jpg' },
      },
      {
        userId: 'user-1',
        pointsAwarded: 50,
        user: { id: 'user-1', name: 'Alice', image: 'alice.jpg' },
      },
      {
        userId: 'user-2',
        pointsAwarded: 75,
        user: { id: 'user-2', name: 'Bob', image: null },
      },
    ])

    const result = await getContributorPoints(mockPrisma as any, 'project-1')

    expect(result).toHaveLength(2)
    // Sorted by points descending
    expect(result[0]).toEqual({
      userId: 'user-1',
      userName: 'Alice',
      userImage: 'alice.jpg',
      points: 150,
    })
    expect(result[1]).toEqual({
      userId: 'user-2',
      userName: 'Bob',
      userImage: null,
      points: 75,
    })
  })

  test('returns empty array when no approved submissions', async () => {
    mockPrisma.submission.findMany.mockResolvedValue([])

    const result = await getContributorPoints(mockPrisma as any, 'project-1')

    expect(result).toEqual([])
  })

  test('handles null pointsAwarded as 0', async () => {
    mockPrisma.submission.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        pointsAwarded: null,
        user: { id: 'user-1', name: 'Alice', image: null },
      },
      {
        userId: 'user-1',
        pointsAwarded: 100,
        user: { id: 'user-1', name: 'Alice', image: null },
      },
    ])

    const result = await getContributorPoints(mockPrisma as any, 'project-1')

    expect(result[0].points).toBe(100)
  })
})

// ================================
// calculatePayout Tests
// ================================

describe('calculatePayout', () => {
  const baseParams = {
    reportedProfitCents: 100000, // $1,000
    poolPercentage: 20, // 20%
    poolCapacity: 1000, // 1000 points
    platformFeePercentage: 2, // 2%
    contributors: [] as ContributorPoints[],
  }

  test('calculates basic payout correctly', () => {
    const result = calculatePayout({
      ...baseParams,
      contributors: [
        { userId: 'user-1', userName: 'Alice', userImage: null, points: 500 },
        { userId: 'user-2', userName: 'Bob', userImage: null, points: 500 },
      ],
    })

    // Pool: $1,000 * 20% = $200 = 20000 cents
    expect(result.poolAmountCents).toBe(20000)

    // 100% utilization (1000 points / 1000 capacity)
    // Platform fee (Shippy's 2% of full pool) = $4 = 400 cents
    // Max distributable (98%) = $196 = 19600 cents
    // At 100%: Shippy = $4, Contributors potential = $196
    // Founder pays = $200 = 20000 cents
    expect(result.founderPaysCents).toBe(20000)

    // Stripe fee from $200: ceil($200 * 2.9%) + $0.30 = $6.10 = 610 cents
    expect(result.stripeFeeCents).toBe(610)

    // Shippy gets 2% of pool at utilization = 400 cents
    expect(result.platformFeeCents).toBe(400)

    // Contributors: $200 - $4 (Shippy) - $6.10 (Stripe) = $189.90 = 18990 cents
    expect(result.distributedAmountCents).toBe(18990)

    // Total earned points
    expect(result.totalEarnedPoints).toBe(1000)

    // Each contributor gets 50% of distributed
    expect(result.breakdown).toHaveLength(2)
    expect(result.breakdown[0].amountCents).toBe(9495)
    expect(result.breakdown[1].amountCents).toBe(9495)
  })

  test('distributes proportionally when earned < capacity', () => {
    const result = calculatePayout({
      ...baseParams,
      contributors: [
        { userId: 'user-1', userName: 'Alice', userImage: null, points: 250 },
        { userId: 'user-2', userName: 'Bob', userImage: null, points: 250 },
      ],
    })

    // 50% utilization (500 points / 1000 capacity)
    // Shippy: 2% of FULL $200 pool = $4 = 400 cents (not scaled!)
    // Contributors potential: 98% of $200 * 50% = $98 = 9800 cents
    // Founder pays = $4 + $98 = $102 = 10200 cents
    expect(result.founderPaysCents).toBe(10200)

    // Stripe fee from $102: ceil($102 * 2.9%) + $0.30 = $3.26 = 326 cents
    expect(result.stripeFeeCents).toBe(326)

    // Shippy: 400 cents (full 2% of pool)
    expect(result.platformFeeCents).toBe(400)

    // Contributors: $102 - $4 - $3.26 = $94.74 = 9474 cents
    expect(result.distributedAmountCents).toBe(9474)

    // Each gets half
    expect(result.breakdown[0].amountCents).toBe(4737)
    expect(result.breakdown[1].amountCents).toBe(4737)
  })

  test('caps distribution at 100% when earned > capacity', () => {
    const result = calculatePayout({
      ...baseParams,
      contributors: [
        { userId: 'user-1', userName: 'Alice', userImage: null, points: 1500 },
        { userId: 'user-2', userName: 'Bob', userImage: null, points: 500 },
      ],
    })

    // Total earned: 2000 > capacity 1000, so capped at 100%
    // Founder pays full pool: $200 = 20000 cents
    expect(result.founderPaysCents).toBe(20000)

    // Contributors: 18990 cents (Stripe absorbed by contributors)
    expect(result.distributedAmountCents).toBe(18990)

    // Proportional: Alice gets 75%, Bob gets 25%
    // Alice: 18990 * 1500 / 2000 = 14242
    // Bob: 18990 * 500 / 2000 = 4747
    expect(result.breakdown[0].amountCents).toBe(14242)
    expect(result.breakdown[1].amountCents).toBe(4747)
  })

  test('handles zero contributors', () => {
    const result = calculatePayout({
      ...baseParams,
      contributors: [],
    })

    expect(result.totalEarnedPoints).toBe(0)
    expect(result.distributedAmountCents).toBe(0)
    expect(result.breakdown).toEqual([])
  })

  test('handles single contributor', () => {
    const result = calculatePayout({
      ...baseParams,
      contributors: [
        { userId: 'user-1', userName: 'Alice', userImage: null, points: 500 },
      ],
    })

    // 50% utilization
    // Shippy: 2% of $200 = $4 (full, not scaled)
    // Contributors: 98% of $200 * 50% = $98, minus Stripe
    // Founder pays: $102, Stripe: $3.26
    // Contributors: $102 - $4 - $3.26 = $94.74
    expect(result.distributedAmountCents).toBe(9474)
    expect(result.breakdown[0].amountCents).toBe(9474)
  })

  test('calculates share percentages correctly', () => {
    const result = calculatePayout({
      ...baseParams,
      poolCapacity: 100,
      contributors: [
        { userId: 'user-1', userName: 'Alice', userImage: null, points: 100 },
      ],
    })

    // Pool: 20000, 100% utilization
    // Distributed: 18990, sharePercent = 18990 / 20000 * 100 = 94.95%
    expect(result.breakdown[0].sharePercent).toBeCloseTo(94.95, 1)
  })

  test('handles zero profit', () => {
    const result = calculatePayout({
      ...baseParams,
      reportedProfitCents: 0,
      contributors: [
        { userId: 'user-1', userName: 'Alice', userImage: null, points: 500 },
      ],
    })

    expect(result.poolAmountCents).toBe(0)
    expect(result.platformFeeCents).toBe(0)
    expect(result.breakdown[0].amountCents).toBe(0)
    expect(result.breakdown[0].sharePercent).toBe(0)
  })

  test('floors fractional cent amounts', () => {
    const result = calculatePayout({
      ...baseParams,
      reportedProfitCents: 33333, // Not evenly divisible
      contributors: [
        { userId: 'user-1', userName: 'Alice', userImage: null, points: 333 },
        { userId: 'user-2', userName: 'Bob', userImage: null, points: 333 },
        { userId: 'user-3', userName: 'Charlie', userImage: null, points: 334 },
      ],
    })

    // All amounts should be integers (floored)
    for (const breakdown of result.breakdown) {
      expect(Number.isInteger(breakdown.amountCents)).toBe(true)
    }
  })

  test('handles unequal point distributions', () => {
    const result = calculatePayout({
      ...baseParams,
      poolCapacity: 100,
      contributors: [
        { userId: 'user-1', userName: 'Alice', userImage: null, points: 80 },
        { userId: 'user-2', userName: 'Bob', userImage: null, points: 20 },
      ],
    })

    // Total: 100 = capacity, so 100% utilization
    // Distributed: 18990 cents
    expect(result.distributedAmountCents).toBe(18990)

    // Alice: 80% of 18990 = 15192
    // Bob: 20% of 18990 = 3798
    expect(result.breakdown[0].amountCents).toBe(15192)
    expect(result.breakdown[1].amountCents).toBe(3798)
  })
})

// ================================
// createPayout Tests
// ================================

describe('createPayout', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  const baseParams = {
    projectId: 'project-1',
    userId: 'founder-1',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-01-31'),
    periodLabel: 'January 2024',
    reportedProfitCents: 100000,
  }

  describe('error cases', () => {
    test('returns NOT_FOUND when project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null)

      const result = await createPayout({
        prisma: mockPrisma as any,
        ...baseParams,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    test('returns FORBIDDEN when user is not founder', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        founderId: 'other-founder',
        rewardPool: {
          poolPercentage: 20,
          poolCapacity: 1000,
          platformFeePercentage: 2,
        },
      })

      const result = await createPayout({
        prisma: mockPrisma as any,
        ...baseParams,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })

    test('returns NO_REWARD_POOL when project has no reward pool', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        founderId: 'founder-1',
        rewardPool: null,
      })

      const result = await createPayout({
        prisma: mockPrisma as any,
        ...baseParams,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NO_REWARD_POOL')
      }
    })

    test('returns NO_CONTRIBUTORS when no one has points', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        founderId: 'founder-1',
        rewardPool: {
          poolPercentage: 20,
          poolCapacity: 1000,
          platformFeePercentage: 2,
        },
      })
      mockPrisma.submission.findMany.mockResolvedValue([])

      const result = await createPayout({
        prisma: mockPrisma as any,
        ...baseParams,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NO_CONTRIBUTORS')
      }
    })
  })

  describe('success cases', () => {
    test('creates payout with recipients', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        founderId: 'founder-1',
        rewardPool: {
          poolPercentage: 20,
          poolCapacity: 1000,
          platformFeePercentage: 2,
        },
      })
      mockPrisma.submission.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          pointsAwarded: 500,
          user: { id: 'user-1', name: 'Alice', image: null },
        },
        {
          userId: 'user-2',
          pointsAwarded: 500,
          user: { id: 'user-2', name: 'Bob', image: null },
        },
      ])
      mockPrisma.payout.create.mockResolvedValue({
        id: 'payout-1',
        periodLabel: 'January 2024',
        reportedProfitCents: BigInt(100000),
        poolAmountCents: BigInt(20000),
        platformFeeCents: BigInt(400),
        totalPointsAtPayout: 1000,
        poolCapacityAtPayout: 1000,
        paymentStatus: 'PENDING', // PayoutPaymentStatus.PENDING
        recipients: [
          { id: 'recipient-1', userId: 'user-1' },
          { id: 'recipient-2', userId: 'user-2' },
        ],
      })

      const result = await createPayout({
        prisma: mockPrisma as any,
        ...baseParams,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.payout.recipientCount).toBe(2)
      }
      expect(mockPrisma.payout.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'project-1',
            periodLabel: 'January 2024',
            reportedProfitCents: 100000,
            recipients: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ userId: 'user-1' }),
                expect.objectContaining({ userId: 'user-2' }),
              ]),
            }),
          }),
        }),
      )
    })
  })
})

// Legacy tests removed: markRecipientPaid, markAllPaid, confirmReceipt
// These functions have been removed in favor of Stripe transfer-based payments

// ================================
// Payout Calculation Edge Cases
// ================================

describe('Payout Calculation Edge Cases', () => {
  test('handles very small profit amounts', () => {
    const result = calculatePayout({
      reportedProfitCents: 100, // $1
      poolPercentage: 20,
      poolCapacity: 1000,
      platformFeePercentage: 2,
      contributors: [
        { userId: 'user-1', userName: 'Alice', userImage: null, points: 1000 },
      ],
    })

    // Pool: $1 * 20% = $0.20 = 20 cents
    expect(result.poolAmountCents).toBe(20)
    // Platform fee (full): 2% of 20 = 0 (floored)
    // Max distributable: 20 - 0 = 20 cents
    // 100% utilization: Shippy = 0, Contributors potential = 20
    // Founder pays: 20 cents
    expect(result.founderPaysCents).toBe(20)
    // Stripe fee: ceil(20 * 2.9%) + 30 = 31 cents (exceeds amount!)
    expect(result.stripeFeeCents).toBe(31)
    // Platform fee at this utilization: 0
    expect(result.platformFeeCents).toBe(0)
    // Distributed: max(0, 20 - 0 - 31) = 0 cents
    expect(result.distributedAmountCents).toBe(0)
  })

  test('handles very large profit amounts', () => {
    const result = calculatePayout({
      reportedProfitCents: 1000000000, // $10,000,000
      poolPercentage: 50,
      poolCapacity: 10000,
      platformFeePercentage: 5,
      contributors: [
        { userId: 'user-1', userName: 'Alice', userImage: null, points: 10000 },
      ],
    })

    // Pool: $10M * 50% = $5M = 500000000 cents
    expect(result.poolAmountCents).toBe(500000000)
    // Platform fee (full): 5% of $5M = $250K = 25000000 cents
    // Max distributable: $4.75M = 475000000 cents
    // 100% utilization, founder pays $5M
    expect(result.founderPaysCents).toBe(500000000)
    // Stripe fee: ceil($5M * 2.9%) + 30 = 14500030 cents
    expect(result.stripeFeeCents).toBe(14500030)
    // Shippy: 25000000 cents
    expect(result.platformFeeCents).toBe(25000000)
    // Distributed: $5M - $250K - Stripe = 500000000 - 25000000 - 14500030 = 460499970
    expect(result.distributedAmountCents).toBe(460499970)
  })

  test('handles single point contributor', () => {
    const result = calculatePayout({
      reportedProfitCents: 100000,
      poolPercentage: 20,
      poolCapacity: 1000,
      platformFeePercentage: 2,
      contributors: [
        { userId: 'user-1', userName: 'Alice', userImage: null, points: 1 },
      ],
    })

    // 1/1000 = 0.1% utilization
    // Shippy: 2% of $200 = $4 = 400 cents (FULL, not scaled)
    // Max distributable: 19600 cents
    // At 0.1%: Contributors potential = 19 cents
    // Founder pays: 400 + 19 = 419 cents
    expect(result.founderPaysCents).toBe(419)
    // Stripe fee on $4.19 = ceil(419 * 2.9%) + 30 = 43 cents
    expect(result.stripeFeeCents).toBe(43)
    // Contributors: 419 - 400 - 43 = -24 → max(0, -24) = 0
    expect(result.distributedAmountCents).toBe(0)
    expect(result.breakdown[0].amountCents).toBe(0)
  })

  test('handles many small contributors', () => {
    const contributors: ContributorPoints[] = Array.from(
      { length: 100 },
      (_, i) => ({
        userId: `user-${i}`,
        userName: `User ${i}`,
        userImage: null,
        points: 10,
      }),
    )

    const result = calculatePayout({
      reportedProfitCents: 100000,
      poolPercentage: 20,
      poolCapacity: 1000,
      platformFeePercentage: 2,
      contributors,
    })

    // Total: 1000 points = capacity = 100% utilization
    expect(result.totalEarnedPoints).toBe(1000)
    // Distributed: 18990 cents (Stripe absorbed by contributors)
    expect(result.distributedAmountCents).toBe(18990)

    // Each gets 1/100 of 18990 = 189 cents (floored)
    for (const breakdown of result.breakdown) {
      expect(breakdown.amountCents).toBe(189)
    }
  })
})
