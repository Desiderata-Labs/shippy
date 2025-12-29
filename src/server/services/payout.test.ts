/* eslint-disable @typescript-eslint/no-explicit-any */
import { PayoutRecipientStatus, PayoutStatus } from '@/lib/db/types'
import {
  type ContributorPoints,
  calculatePayout,
  confirmReceipt,
  createPayout,
  getContributorPoints,
  markAllPaid,
  markRecipientPaid,
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

    // Platform fee: $200 * 2% = $4 = 400 cents
    expect(result.platformFeeCents).toBe(400)

    // Max distributable: $200 - $4 = $196 = 19600 cents
    expect(result.maxDistributableCents).toBe(19600)

    // Total points: 1000 = capacity, so 100% is distributed
    expect(result.distributedAmountCents).toBe(19600)

    // Total earned points
    expect(result.totalEarnedPoints).toBe(1000)

    // Each contributor gets 50%
    expect(result.breakdown).toHaveLength(2)
    expect(result.breakdown[0].amountCents).toBe(9800)
    expect(result.breakdown[1].amountCents).toBe(9800)
  })

  test('distributes proportionally when earned < capacity', () => {
    const result = calculatePayout({
      ...baseParams,
      contributors: [
        { userId: 'user-1', userName: 'Alice', userImage: null, points: 250 },
        { userId: 'user-2', userName: 'Bob', userImage: null, points: 250 },
      ],
    })

    // Total earned: 500 / 1000 capacity = 50%
    // Distributed: 19600 * 50% = 9800 cents
    expect(result.distributedAmountCents).toBe(9800)

    // Each gets 4900 cents
    expect(result.breakdown[0].amountCents).toBe(4900)
    expect(result.breakdown[1].amountCents).toBe(4900)
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
    expect(result.distributedAmountCents).toBe(19600)

    // Proportional: Alice gets 75%, Bob gets 25%
    // Alice: 19600 * 1500 / 2000 = 14700
    // Bob: 19600 * 500 / 2000 = 4900
    expect(result.breakdown[0].amountCents).toBe(14700)
    expect(result.breakdown[1].amountCents).toBe(4900)
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

    // 500/1000 = 50% of pool
    expect(result.distributedAmountCents).toBe(9800)
    expect(result.breakdown[0].amountCents).toBe(9800)
  })

  test('calculates share percentages correctly', () => {
    const result = calculatePayout({
      ...baseParams,
      poolCapacity: 100,
      contributors: [
        { userId: 'user-1', userName: 'Alice', userImage: null, points: 100 },
      ],
    })

    // Pool: 20000, fee: 400, distributable: 19600
    // Alice gets 19600, which is 98% of 20000 pool
    expect(result.breakdown[0].sharePercent).toBe(98)
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

    // Total: 100 = capacity, so full distribution
    expect(result.distributedAmountCents).toBe(19600)

    // Alice: 80% of 19600 = 15680
    // Bob: 20% of 19600 = 3920
    expect(result.breakdown[0].amountCents).toBe(15680)
    expect(result.breakdown[1].amountCents).toBe(3920)
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
        status: PayoutStatus.ANNOUNCED,
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

// ================================
// markRecipientPaid Tests
// ================================

describe('markRecipientPaid', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  test('returns NOT_FOUND when recipient does not exist', async () => {
    mockPrisma.payoutRecipient.findUnique.mockResolvedValue(null)

    const result = await markRecipientPaid({
      prisma: mockPrisma as any,
      recipientId: 'non-existent',
      userId: 'founder-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_FOUND')
    }
  })

  test('returns FORBIDDEN when user is not founder', async () => {
    mockPrisma.payoutRecipient.findUnique.mockResolvedValue({
      id: 'recipient-1',
      userId: 'user-1',
      payoutId: 'payout-1',
      payout: {
        project: { founderId: 'other-founder' },
      },
    })

    const result = await markRecipientPaid({
      prisma: mockPrisma as any,
      recipientId: 'recipient-1',
      userId: 'founder-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('FORBIDDEN')
    }
  })

  test('marks recipient as paid and checks for full payout completion', async () => {
    mockPrisma.payoutRecipient.findUnique.mockResolvedValue({
      id: 'recipient-1',
      userId: 'user-1',
      payoutId: 'payout-1',
      payout: {
        project: { founderId: 'founder-1' },
      },
    })
    mockPrisma.payoutRecipient.update.mockResolvedValue({
      id: 'recipient-1',
      paidAt: new Date(),
      paidNote: 'Paid via PayPal',
    })
    mockPrisma.payoutRecipient.count.mockResolvedValue(1) // 1 unpaid remaining

    const result = await markRecipientPaid({
      prisma: mockPrisma as any,
      recipientId: 'recipient-1',
      userId: 'founder-1',
      note: 'Paid via PayPal',
    })

    expect(result.success).toBe(true)
    expect(mockPrisma.payoutRecipient.update).toHaveBeenCalledWith({
      where: { id: 'recipient-1' },
      data: {
        paidAt: expect.any(Date),
        paidNote: 'Paid via PayPal',
      },
    })
    // Payout should NOT be updated since there's still 1 unpaid
    expect(mockPrisma.payout.update).not.toHaveBeenCalled()
    if (result.success) {
      expect(result.payoutStatusUpdated).toBe(false)
    }
  })

  test('updates payout status when all recipients are paid', async () => {
    mockPrisma.payoutRecipient.findUnique.mockResolvedValue({
      id: 'recipient-1',
      userId: 'user-1',
      payoutId: 'payout-1',
      payout: {
        project: { founderId: 'founder-1' },
      },
    })
    mockPrisma.payoutRecipient.update.mockResolvedValue({
      id: 'recipient-1',
      paidAt: new Date(),
      paidNote: null,
    })
    mockPrisma.payoutRecipient.count.mockResolvedValue(0) // All paid
    mockPrisma.payout.update.mockResolvedValue({})

    const result = await markRecipientPaid({
      prisma: mockPrisma as any,
      recipientId: 'recipient-1',
      userId: 'founder-1',
    })

    expect(result.success).toBe(true)
    expect(mockPrisma.payout.update).toHaveBeenCalledWith({
      where: { id: 'payout-1' },
      data: {
        status: PayoutStatus.SENT,
        sentAt: expect.any(Date),
      },
    })
    if (result.success) {
      expect(result.payoutStatusUpdated).toBe(true)
    }
  })
})

// ================================
// markAllPaid Tests
// ================================

describe('markAllPaid', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  test('returns NOT_FOUND when payout does not exist', async () => {
    mockPrisma.payout.findUnique.mockResolvedValue(null)

    const result = await markAllPaid({
      prisma: mockPrisma as any,
      payoutId: 'non-existent',
      userId: 'founder-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_FOUND')
    }
  })

  test('returns FORBIDDEN when user is not founder', async () => {
    mockPrisma.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      project: { founderId: 'other-founder' },
    })

    const result = await markAllPaid({
      prisma: mockPrisma as any,
      payoutId: 'payout-1',
      userId: 'founder-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('FORBIDDEN')
    }
  })

  test('marks all unpaid recipients and updates payout status', async () => {
    mockPrisma.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      project: { founderId: 'founder-1' },
    })
    mockPrisma.payoutRecipient.findMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ])
    mockPrisma.payoutRecipient.updateMany.mockResolvedValue({ count: 2 })
    mockPrisma.payout.update.mockResolvedValue({
      id: 'payout-1',
      status: PayoutStatus.SENT,
      sentAt: new Date(),
    })

    const result = await markAllPaid({
      prisma: mockPrisma as any,
      payoutId: 'payout-1',
      userId: 'founder-1',
      note: 'Bulk payment',
    })

    expect(result.success).toBe(true)
    expect(mockPrisma.payoutRecipient.updateMany).toHaveBeenCalledWith({
      where: {
        payoutId: 'payout-1',
        paidAt: null,
      },
      data: {
        paidAt: expect.any(Date),
        paidNote: 'Bulk payment',
      },
    })
    expect(mockPrisma.payout.update).toHaveBeenCalledWith({
      where: { id: 'payout-1' },
      data: {
        status: PayoutStatus.SENT,
        sentAt: expect.any(Date),
        sentNote: 'Bulk payment',
      },
    })
    if (result.success) {
      expect(result.recipientsUpdated).toBe(2)
    }
  })
})

// ================================
// confirmReceipt Tests
// ================================

describe('confirmReceipt', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  test('returns NOT_RECIPIENT when user is not a recipient', async () => {
    mockPrisma.payoutRecipient.findFirst.mockResolvedValue(null)

    const result = await confirmReceipt({
      prisma: mockPrisma as any,
      payoutId: 'payout-1',
      userId: 'random-user',
      confirmed: true,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_RECIPIENT')
    }
  })

  test('confirms receipt successfully', async () => {
    mockPrisma.payoutRecipient.findFirst.mockResolvedValue({
      id: 'recipient-1',
      userId: 'user-1',
      payoutId: 'payout-1',
      payout: {
        project: { founderId: 'founder-1' },
      },
    })
    mockPrisma.payoutRecipient.update.mockResolvedValue({
      id: 'recipient-1',
      status: PayoutRecipientStatus.CONFIRMED,
      confirmedAt: new Date(),
      disputedAt: null,
    })

    const result = await confirmReceipt({
      prisma: mockPrisma as any,
      payoutId: 'payout-1',
      userId: 'user-1',
      confirmed: true,
      note: 'Received, thank you!',
    })

    expect(result.success).toBe(true)
    expect(mockPrisma.payoutRecipient.update).toHaveBeenCalledWith({
      where: { id: 'recipient-1' },
      data: {
        status: PayoutRecipientStatus.CONFIRMED,
        confirmedAt: expect.any(Date),
        confirmNote: 'Received, thank you!',
      },
    })
  })

  test('disputes receipt successfully', async () => {
    mockPrisma.payoutRecipient.findFirst.mockResolvedValue({
      id: 'recipient-1',
      userId: 'user-1',
      payoutId: 'payout-1',
      payout: {
        project: { founderId: 'founder-1' },
      },
    })
    mockPrisma.payoutRecipient.update.mockResolvedValue({
      id: 'recipient-1',
      status: PayoutRecipientStatus.DISPUTED,
      confirmedAt: null,
      disputedAt: new Date(),
    })

    const result = await confirmReceipt({
      prisma: mockPrisma as any,
      payoutId: 'payout-1',
      userId: 'user-1',
      confirmed: false,
      disputeReason: 'Never received payment',
    })

    expect(result.success).toBe(true)
    expect(mockPrisma.payoutRecipient.update).toHaveBeenCalledWith({
      where: { id: 'recipient-1' },
      data: {
        status: PayoutRecipientStatus.DISPUTED,
        disputedAt: expect.any(Date),
        disputeReason: 'Never received payment',
      },
    })
  })
})

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
    // Fee: $0.20 * 2% = 0 cents (floored)
    expect(result.platformFeeCents).toBe(0)
    // Distributed: 20 cents
    expect(result.distributedAmountCents).toBe(20)
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
    // Fee: $5M * 5% = $250K = 25000000 cents
    expect(result.platformFeeCents).toBe(25000000)
    // Distributed: $5M - $250K = $4.75M = 475000000 cents
    expect(result.distributedAmountCents).toBe(475000000)
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

    // 1/1000 = 0.1% of pool
    // 19600 * 1/1000 = 19 cents (floored)
    expect(result.distributedAmountCents).toBe(19)
    expect(result.breakdown[0].amountCents).toBe(19)
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

    // Total: 1000 points = capacity
    expect(result.totalEarnedPoints).toBe(1000)
    expect(result.distributedAmountCents).toBe(19600)

    // Each gets 1/100 = 196 cents
    for (const breakdown of result.breakdown) {
      expect(breakdown.amountCents).toBe(196)
    }
  })
})
