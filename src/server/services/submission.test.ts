/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BountyClaimMode,
  BountyStatus,
  ClaimStatus,
  SubmissionEventType,
  SubmissionStatus,
} from '@/lib/db/types'
import {
  approveSubmission,
  createSubmission,
  rejectSubmission,
  updateBountyStatusOnClaimResolution,
  updateSubmission,
} from './submission'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock the notification module
vi.mock('@/server/routers/notification', () => ({
  createNotifications: vi.fn().mockResolvedValue(undefined),
}))

// Mock the global prisma client used for notifications and GitHub
vi.mock('@/lib/db/server', () => ({
  prisma: {
    gitHubPRLink: { findUnique: vi.fn().mockResolvedValue(null) },
    gitHubConnection: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}))

// Mock GitHub server functions
vi.mock('@/lib/github/server', () => ({
  getInstallationOctokit: vi.fn(),
  formatAutoApproveComment: vi.fn().mockReturnValue('Approved!'),
}))

// ================================
// Mock Factory
// ================================

type MockPrisma = {
  submission: {
    findUnique: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    aggregate: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
  }
  submissionEvent: {
    create: ReturnType<typeof vi.fn>
  }
  bountyClaim: {
    findFirst: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    updateMany: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
  }
  bounty: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  rewardPool: {
    update: ReturnType<typeof vi.fn>
  }
  poolExpansionEvent: {
    create: ReturnType<typeof vi.fn>
  }
  $transaction: ReturnType<typeof vi.fn>
}

function createMockPrisma(): MockPrisma {
  const mock: MockPrisma = {
    submission: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    submissionEvent: {
      create: vi.fn(),
    },
    bountyClaim: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    bounty: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    rewardPool: {
      update: vi.fn(),
    },
    poolExpansionEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  mock.$transaction.mockImplementation(
    async (cb: (tx: MockPrisma) => unknown) => cb(mock),
  )
  return mock
}

// ================================
// approveSubmission Tests
// ================================

describe('approveSubmission', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('throws when submission not found', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue(null)

      await expect(
        approveSubmission({
          prisma: mockPrisma as any,
          submissionId: 'non-existent',
          pointsAwarded: 100,
          actorId: 'founder-1',
        }),
      ).rejects.toThrow('Submission not found')
    })

    test('throws when points awarded is below bounty points', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          title: 'Test Bounty',
          number: 1,
          points: 100,
          claimMode: BountyClaimMode.SINGLE,
          maxClaims: null,
          project: {
            id: 'project-1',
            slug: 'test-project',
            projectKey: 'TST',
            rewardPool: null,
          },
        },
      })

      await expect(
        approveSubmission({
          prisma: mockPrisma as any,
          submissionId: 'sub-1',
          pointsAwarded: 50,
          actorId: 'founder-1',
        }),
      ).rejects.toThrow('cannot be lower than bounty points')
    })
  })

  describe('pool capacity expansion', () => {
    test('expands pool capacity when points exceed current capacity', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          title: 'Test Bounty',
          number: 1,
          claimMode: BountyClaimMode.SINGLE,
          maxClaims: null,
          project: {
            id: 'project-1',
            slug: 'test-project',
            projectKey: 'TST',
            rewardPool: {
              id: 'pool-1',
              poolCapacity: 500, // Current capacity
            },
          },
        },
      })
      // Current earned points: 400
      mockPrisma.submission.aggregate.mockResolvedValue({
        _sum: { pointsAwarded: 400 },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.rewardPool.update.mockResolvedValue({})
      mockPrisma.poolExpansionEvent.create.mockResolvedValue({})
      mockPrisma.submission.count.mockResolvedValue(1)
      mockPrisma.bounty.update.mockResolvedValue({})

      // Award 200 points → total 600 > capacity 500
      await approveSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        pointsAwarded: 200,
        actorId: 'founder-1',
      })

      expect(mockPrisma.rewardPool.update).toHaveBeenCalledWith({
        where: { id: 'pool-1' },
        data: { poolCapacity: 600 },
      })
      expect(mockPrisma.poolExpansionEvent.create).toHaveBeenCalled()
    })

    test('does NOT expand pool when points within capacity', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          title: 'Test Bounty',
          number: 1,
          claimMode: BountyClaimMode.SINGLE,
          maxClaims: null,
          project: {
            id: 'project-1',
            slug: 'test-project',
            projectKey: 'TST',
            rewardPool: {
              id: 'pool-1',
              poolCapacity: 1000,
            },
          },
        },
      })
      mockPrisma.submission.aggregate.mockResolvedValue({
        _sum: { pointsAwarded: 400 },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.submission.count.mockResolvedValue(1)
      mockPrisma.bounty.update.mockResolvedValue({})

      // Award 100 points → total 500 <= capacity 1000
      await approveSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        pointsAwarded: 100,
        actorId: 'founder-1',
      })

      expect(mockPrisma.rewardPool.update).not.toHaveBeenCalled()
      expect(mockPrisma.poolExpansionEvent.create).not.toHaveBeenCalled()
    })
  })

  describe('SINGLE mode behavior', () => {
    test('completes bounty on first approval', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          title: 'Test Bounty',
          number: 1,
          claimMode: BountyClaimMode.SINGLE,
          maxClaims: null,
          project: {
            id: 'project-1',
            slug: 'test-project',
            projectKey: 'TST',
            rewardPool: null,
          },
        },
      })
      mockPrisma.submission.aggregate.mockResolvedValue({
        _sum: { pointsAwarded: null },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.submission.count.mockResolvedValue(1)
      mockPrisma.bounty.update.mockResolvedValue({})

      await approveSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        pointsAwarded: 100,
        actorId: 'founder-1',
      })

      expect(mockPrisma.bounty.update).toHaveBeenCalledWith({
        where: { id: 'bounty-1' },
        data: { status: BountyStatus.COMPLETED },
      })
    })
  })

  describe('COMPETITIVE mode behavior', () => {
    test('expires other claims when first submission approved', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'winner-user',
        bounty: {
          id: 'bounty-1',
          title: 'Race Bounty',
          number: 1,
          claimMode: BountyClaimMode.COMPETITIVE,
          maxClaims: null,
          project: {
            id: 'project-1',
            slug: 'test-project',
            projectKey: 'TST',
            rewardPool: null,
          },
        },
      })
      mockPrisma.submission.aggregate.mockResolvedValue({
        _sum: { pointsAwarded: null },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      // Find losing claims
      mockPrisma.bountyClaim.findMany.mockResolvedValue([
        { id: 'loser-claim-1', userId: 'loser-user-1' },
        { id: 'loser-claim-2', userId: 'loser-user-2' },
      ])
      // Find losing submissions
      mockPrisma.submission.findMany.mockResolvedValue([
        {
          id: 'loser-sub-1',
          status: SubmissionStatus.PENDING,
          userId: 'loser-user-1',
        },
      ])
      mockPrisma.submission.count.mockResolvedValue(1)
      mockPrisma.bounty.update.mockResolvedValue({})

      await approveSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        pointsAwarded: 100,
        actorId: 'founder-1',
      })

      // Should expire losing claims
      expect(mockPrisma.bountyClaim.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['loser-claim-1', 'loser-claim-2'] },
        },
        data: { status: ClaimStatus.EXPIRED },
      })

      // Should withdraw losing submissions
      expect(mockPrisma.submission.update).toHaveBeenCalledWith({
        where: { id: 'loser-sub-1' },
        data: { status: SubmissionStatus.WITHDRAWN },
      })
    })

    test('completes bounty on first approval (first wins)', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          title: 'Race Bounty',
          number: 1,
          claimMode: BountyClaimMode.COMPETITIVE,
          maxClaims: null,
          project: {
            id: 'project-1',
            slug: 'test-project',
            projectKey: 'TST',
            rewardPool: null,
          },
        },
      })
      mockPrisma.submission.aggregate.mockResolvedValue({
        _sum: { pointsAwarded: null },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.bountyClaim.findMany.mockResolvedValue([])
      mockPrisma.submission.count.mockResolvedValue(1)
      mockPrisma.bounty.update.mockResolvedValue({})

      await approveSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        pointsAwarded: 100,
        actorId: 'founder-1',
      })

      expect(mockPrisma.bounty.update).toHaveBeenCalledWith({
        where: { id: 'bounty-1' },
        data: { status: BountyStatus.COMPLETED },
      })
    })
  })

  describe('MULTIPLE mode behavior', () => {
    test('does NOT complete bounty when no maxClaims limit, but reopens when no active claims', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          title: 'Multi Bounty',
          number: 1,
          claimMode: BountyClaimMode.MULTIPLE,
          maxClaims: null, // No limit
          project: {
            id: 'project-1',
            slug: 'test-project',
            projectKey: 'TST',
            rewardPool: null,
          },
        },
      })
      mockPrisma.submission.aggregate.mockResolvedValue({
        _sum: { pointsAwarded: null },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.submission.count.mockResolvedValue(3) // 3 approvals
      // Mock for updateBountyStatusOnClaimResolution
      mockPrisma.bounty.findUnique.mockResolvedValue({
        status: BountyStatus.CLAIMED,
      })
      mockPrisma.bountyClaim.count.mockResolvedValue(0) // No active claims remaining
      mockPrisma.bounty.update.mockResolvedValue({})

      await approveSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        pointsAwarded: 100,
        actorId: 'founder-1',
      })

      // Should NOT complete bounty, but should reopen to OPEN
      expect(mockPrisma.bounty.update).toHaveBeenCalledWith({
        where: { id: 'bounty-1' },
        data: { status: BountyStatus.OPEN },
      })
    })

    test('stays CLAIMED when there are other active claims', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          title: 'Multi Bounty',
          number: 1,
          claimMode: BountyClaimMode.MULTIPLE,
          maxClaims: null, // No limit
          project: {
            id: 'project-1',
            slug: 'test-project',
            projectKey: 'TST',
            rewardPool: null,
          },
        },
      })
      mockPrisma.submission.aggregate.mockResolvedValue({
        _sum: { pointsAwarded: null },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.submission.count.mockResolvedValue(3) // 3 approvals
      // Mock for updateBountyStatusOnClaimResolution
      mockPrisma.bounty.findUnique.mockResolvedValue({
        status: BountyStatus.CLAIMED,
      })
      mockPrisma.bountyClaim.count.mockResolvedValue(2) // 2 other active claims

      await approveSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        pointsAwarded: 100,
        actorId: 'founder-1',
      })

      // Should NOT update bounty status
      expect(mockPrisma.bounty.update).not.toHaveBeenCalled()
    })

    test('does NOT complete bounty when approvedCount < maxClaims', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          title: 'Multi Bounty',
          number: 1,
          claimMode: BountyClaimMode.MULTIPLE,
          maxClaims: 5, // Limit of 5
          project: {
            id: 'project-1',
            slug: 'test-project',
            projectKey: 'TST',
            rewardPool: null,
          },
        },
      })
      mockPrisma.submission.aggregate.mockResolvedValue({
        _sum: { pointsAwarded: null },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.submission.count.mockResolvedValue(3) // Only 3 approvals
      // Mock for updateBountyStatusOnClaimResolution
      mockPrisma.bounty.findUnique.mockResolvedValue({
        status: BountyStatus.CLAIMED,
      })
      mockPrisma.bountyClaim.count.mockResolvedValue(0) // No active claims
      mockPrisma.bounty.update.mockResolvedValue({})

      await approveSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        pointsAwarded: 100,
        actorId: 'founder-1',
      })

      // Should NOT complete bounty, but reopens to OPEN
      expect(mockPrisma.bounty.update).toHaveBeenCalledWith({
        where: { id: 'bounty-1' },
        data: { status: BountyStatus.OPEN },
      })
    })

    test('completes bounty when approvedCount reaches maxClaims', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          title: 'Multi Bounty',
          number: 1,
          claimMode: BountyClaimMode.MULTIPLE,
          maxClaims: 5, // Limit of 5
          project: {
            id: 'project-1',
            slug: 'test-project',
            projectKey: 'TST',
            rewardPool: null,
          },
        },
      })
      mockPrisma.submission.aggregate.mockResolvedValue({
        _sum: { pointsAwarded: null },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.submission.count.mockResolvedValue(5) // Reached limit

      await approveSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        pointsAwarded: 100,
        actorId: 'founder-1',
      })

      expect(mockPrisma.bounty.update).toHaveBeenCalledWith({
        where: { id: 'bounty-1' },
        data: { status: BountyStatus.COMPLETED },
      })
    })
  })

  describe('PERFORMANCE mode behavior', () => {
    test('never auto-completes bounty, but reopens when no active claims', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          title: 'Referral Bounty',
          number: 1,
          claimMode: BountyClaimMode.PERFORMANCE,
          maxClaims: null,
          project: {
            id: 'project-1',
            slug: 'test-project',
            projectKey: 'TST',
            rewardPool: null,
          },
        },
      })
      mockPrisma.submission.aggregate.mockResolvedValue({
        _sum: { pointsAwarded: null },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.submission.count.mockResolvedValue(1000) // Many approvals
      // Mock for updateBountyStatusOnClaimResolution
      mockPrisma.bounty.findUnique.mockResolvedValue({
        status: BountyStatus.CLAIMED,
      })
      mockPrisma.bountyClaim.count.mockResolvedValue(0) // No active claims
      mockPrisma.bounty.update.mockResolvedValue({})

      await approveSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        pointsAwarded: 10,
        actorId: 'founder-1',
      })

      // Should NOT complete bounty, but reopens to OPEN since no active claims
      expect(mockPrisma.bounty.update).toHaveBeenCalledWith({
        where: { id: 'bounty-1' },
        data: { status: BountyStatus.OPEN },
      })
    })
  })

  describe('claim status updates', () => {
    test('updates claim status to COMPLETED', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          title: 'Test Bounty',
          number: 1,
          claimMode: BountyClaimMode.SINGLE,
          maxClaims: null,
          project: {
            id: 'project-1',
            slug: 'test-project',
            projectKey: 'TST',
            rewardPool: null,
          },
        },
      })
      mockPrisma.submission.aggregate.mockResolvedValue({
        _sum: { pointsAwarded: null },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.submission.count.mockResolvedValue(1)
      mockPrisma.bounty.update.mockResolvedValue({})

      await approveSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        pointsAwarded: 100,
        actorId: 'founder-1',
      })

      expect(mockPrisma.bountyClaim.updateMany).toHaveBeenCalledWith({
        where: {
          bountyId: 'bounty-1',
          userId: 'user-1',
        },
        data: { status: ClaimStatus.COMPLETED },
      })
    })
  })

  describe('audit trail', () => {
    test('creates submission event with note', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          title: 'Test Bounty',
          number: 1,
          claimMode: BountyClaimMode.SINGLE,
          maxClaims: null,
          project: {
            id: 'project-1',
            slug: 'test-project',
            projectKey: 'TST',
            rewardPool: null,
          },
        },
      })
      mockPrisma.submission.aggregate.mockResolvedValue({
        _sum: { pointsAwarded: null },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.submission.count.mockResolvedValue(1)
      mockPrisma.bounty.update.mockResolvedValue({})

      await approveSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        pointsAwarded: 100,
        actorId: 'founder-1',
        note: 'Great work!',
      })

      expect(mockPrisma.submissionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          submissionId: 'sub-1',
          userId: 'founder-1',
          note: 'Great work!',
          fromStatus: SubmissionStatus.PENDING,
          toStatus: SubmissionStatus.APPROVED,
        }),
      })
    })
  })
})

// ================================
// updateSubmission Tests
// ================================

describe('updateSubmission', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  test('updates description and records edit event', async () => {
    mockPrisma.submission.findUnique.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      status: SubmissionStatus.DRAFT,
      description: 'Old description',
    })

    mockPrisma.submission.update.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      status: SubmissionStatus.DRAFT,
      description: 'New description',
    })

    const result = await updateSubmission({
      prisma: mockPrisma as any,
      submissionId: 'sub-1',
      userId: 'user-1',
      description: 'New description',
    })

    expect(result.success).toBe(true)
    expect(mockPrisma.submission.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { description: 'New description' },
    })
    expect(mockPrisma.submissionEvent.create).toHaveBeenCalledWith({
      data: {
        submissionId: 'sub-1',
        userId: 'user-1',
        type: SubmissionEventType.EDIT,
        changes: {
          description: { from: 'Old description', to: 'New description' },
        },
      },
    })
  })
})

// ================================
// createSubmission Tests
// ================================

describe('createSubmission', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns NOT_FOUND when bounty does not exist', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue(null)

      const result = await createSubmission({
        prisma: mockPrisma as any,
        bountyId: 'non-existent',
        userId: 'user-1',
        description: 'My work',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    test('returns NO_CLAIM when user has no active claim', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        claimMode: BountyClaimMode.SINGLE,
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue(null)

      const result = await createSubmission({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
        description: 'My work',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NO_CLAIM')
      }
    })

    test('returns ALREADY_SUBMITTED for SINGLE mode with existing submission', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        claimMode: BountyClaimMode.SINGLE,
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        status: ClaimStatus.ACTIVE,
      })
      mockPrisma.submission.findFirst.mockResolvedValue({
        id: 'existing-sub',
        status: SubmissionStatus.PENDING,
      })

      const result = await createSubmission({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
        description: 'My work',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('ALREADY_SUBMITTED')
      }
    })

    test('returns ALREADY_SUBMITTED for COMPETITIVE mode with existing submission', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        claimMode: BountyClaimMode.COMPETITIVE,
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        status: ClaimStatus.ACTIVE,
      })
      mockPrisma.submission.findFirst.mockResolvedValue({
        id: 'existing-sub',
        status: SubmissionStatus.PENDING,
      })

      const result = await createSubmission({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
        description: 'My work',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('ALREADY_SUBMITTED')
      }
    })
  })

  describe('success cases', () => {
    test('creates submission for SINGLE mode', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        claimMode: BountyClaimMode.SINGLE,
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        status: ClaimStatus.ACTIVE,
      })
      mockPrisma.submission.findFirst.mockResolvedValue(null)
      mockPrisma.submission.create.mockResolvedValue({
        id: 'new-sub-1',
      })
      mockPrisma.bountyClaim.update.mockResolvedValue({})

      const result = await createSubmission({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
        description: 'My completed work',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.submission.id).toBe('new-sub-1')
      }
      expect(mockPrisma.submission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bountyId: 'bounty-1',
          userId: 'user-1',
          description: 'My completed work',
          status: SubmissionStatus.PENDING,
        }),
      })
    })

    test('creates draft submission when isDraft is true', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        claimMode: BountyClaimMode.SINGLE,
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        status: ClaimStatus.ACTIVE,
      })
      mockPrisma.submission.findFirst.mockResolvedValue(null)
      mockPrisma.submission.create.mockResolvedValue({
        id: 'new-sub-1',
      })
      mockPrisma.bountyClaim.update.mockResolvedValue({})

      await createSubmission({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
        description: 'Work in progress',
        isDraft: true,
      })

      expect(mockPrisma.submission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: SubmissionStatus.DRAFT,
        }),
      })
    })

    test('allows multiple submissions for MULTIPLE mode', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        claimMode: BountyClaimMode.MULTIPLE,
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        status: ClaimStatus.ACTIVE,
      })
      // Note: findFirst is NOT called for MULTIPLE mode because it allows multiple
      mockPrisma.submission.create.mockResolvedValue({
        id: 'new-sub-2',
      })
      mockPrisma.bountyClaim.update.mockResolvedValue({})

      const result = await createSubmission({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
        description: 'Second submission',
      })

      expect(result.success).toBe(true)
      // Should NOT check for existing submissions in MULTIPLE mode
      expect(mockPrisma.submission.findFirst).not.toHaveBeenCalled()
    })

    test('allows multiple submissions for PERFORMANCE mode', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        claimMode: BountyClaimMode.PERFORMANCE,
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        status: ClaimStatus.ACTIVE,
      })
      mockPrisma.submission.create.mockResolvedValue({
        id: 'new-sub-3',
      })
      mockPrisma.bountyClaim.update.mockResolvedValue({})

      const result = await createSubmission({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
        description: 'Referral evidence',
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.submission.findFirst).not.toHaveBeenCalled()
    })

    test('updates claim status to SUBMITTED', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        claimMode: BountyClaimMode.SINGLE,
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        status: ClaimStatus.ACTIVE,
      })
      mockPrisma.submission.findFirst.mockResolvedValue(null)
      mockPrisma.submission.create.mockResolvedValue({
        id: 'new-sub-1',
      })
      mockPrisma.bountyClaim.update.mockResolvedValue({})

      await createSubmission({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
        description: 'My work',
      })

      expect(mockPrisma.bountyClaim.update).toHaveBeenCalledWith({
        where: { id: 'claim-1' },
        data: { status: ClaimStatus.SUBMITTED },
      })
    })

    test('skips claim check when skipClaimCheck is true', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        claimMode: BountyClaimMode.SINGLE,
        project: { founderId: 'founder-1' },
      })
      // Returns null because skipClaimCheck is true, it still tries to find claim for status update
      mockPrisma.bountyClaim.findFirst.mockResolvedValue(null)
      mockPrisma.submission.findFirst.mockResolvedValue(null)
      mockPrisma.submission.create.mockResolvedValue({
        id: 'new-sub-1',
      })

      const result = await createSubmission({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
        description: 'Auto-created submission',
        skipClaimCheck: true,
      })

      expect(result.success).toBe(true)
      // Should NOT update claim since none was found
      expect(mockPrisma.bountyClaim.update).not.toHaveBeenCalled()
    })

    test('ignores rejected submissions when checking for duplicates', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        claimMode: BountyClaimMode.SINGLE,
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        status: ClaimStatus.ACTIVE,
      })
      // No non-rejected submissions found
      mockPrisma.submission.findFirst.mockResolvedValue(null)
      mockPrisma.submission.create.mockResolvedValue({
        id: 'new-sub-1',
      })
      mockPrisma.bountyClaim.update.mockResolvedValue({})

      const result = await createSubmission({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
        description: 'Retry after rejection',
      })

      expect(result.success).toBe(true)
      // The query should exclude REJECTED and WITHDRAWN statuses
      expect(mockPrisma.submission.findFirst).toHaveBeenCalledWith({
        where: {
          bountyId: 'bounty-1',
          userId: 'user-1',
          status: {
            notIn: [SubmissionStatus.REJECTED, SubmissionStatus.WITHDRAWN],
          },
        },
      })
    })
  })
})

// ================================
// rejectSubmission Tests
// ================================

describe('rejectSubmission', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('throws when submission not found', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue(null)

      await expect(
        rejectSubmission({
          prisma: mockPrisma as any,
          submissionId: 'non-existent',
          actorId: 'founder-1',
          note: 'Rejected',
        }),
      ).rejects.toThrow('Submission not found')
    })
  })

  describe('success cases', () => {
    test('rejects submission and expires claim', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          claimMode: BountyClaimMode.SINGLE,
        },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      // Mock for updateBountyStatusOnClaimResolution
      mockPrisma.bounty.findUnique.mockResolvedValue({
        status: BountyStatus.CLAIMED,
      })
      mockPrisma.bountyClaim.count.mockResolvedValue(0) // No remaining active claims
      mockPrisma.bounty.update.mockResolvedValue({})

      await rejectSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        actorId: 'founder-1',
        note: 'Not good enough',
      })

      // Should update submission to REJECTED
      expect(mockPrisma.submission.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          status: SubmissionStatus.REJECTED,
          rejectionNote: 'Not good enough',
        }),
      })

      // Should expire the claim
      expect(mockPrisma.bountyClaim.updateMany).toHaveBeenCalledWith({
        where: {
          bountyId: 'bounty-1',
          userId: 'user-1',
          status: { in: [ClaimStatus.ACTIVE, ClaimStatus.SUBMITTED] },
        },
        data: { status: ClaimStatus.EXPIRED },
      })

      // Should create rejection event
      expect(mockPrisma.submissionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          submissionId: 'sub-1',
          userId: 'founder-1',
          type: SubmissionEventType.STATUS_CHANGE,
          fromStatus: SubmissionStatus.PENDING,
          toStatus: SubmissionStatus.REJECTED,
          note: 'Not good enough',
        }),
      })
    })

    test('reopens bounty when no active claims remain (SINGLE mode)', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          claimMode: BountyClaimMode.SINGLE,
        },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.bounty.findUnique.mockResolvedValue({
        status: BountyStatus.CLAIMED,
      })
      mockPrisma.bountyClaim.count.mockResolvedValue(0) // No remaining active claims
      mockPrisma.bounty.update.mockResolvedValue({})

      await rejectSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        actorId: 'founder-1',
        note: 'Rejected',
      })

      // Should reopen bounty to OPEN
      expect(mockPrisma.bounty.update).toHaveBeenCalledWith({
        where: { id: 'bounty-1' },
        data: { status: BountyStatus.OPEN },
      })
    })

    test('reopens bounty when no active claims remain (MULTIPLE mode)', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          claimMode: BountyClaimMode.MULTIPLE,
        },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.bounty.findUnique.mockResolvedValue({
        status: BountyStatus.CLAIMED,
      })
      mockPrisma.bountyClaim.count.mockResolvedValue(0) // No remaining active claims
      mockPrisma.bounty.update.mockResolvedValue({})

      await rejectSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        actorId: 'founder-1',
        note: 'Rejected',
      })

      // Should reopen bounty to OPEN
      expect(mockPrisma.bounty.update).toHaveBeenCalledWith({
        where: { id: 'bounty-1' },
        data: { status: BountyStatus.OPEN },
      })
    })

    test('does NOT reopen bounty when other active claims remain', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: SubmissionStatus.PENDING,
        bountyId: 'bounty-1',
        userId: 'user-1',
        bounty: {
          id: 'bounty-1',
          claimMode: BountyClaimMode.COMPETITIVE,
        },
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.bounty.findUnique.mockResolvedValue({
        status: BountyStatus.CLAIMED,
      })
      mockPrisma.bountyClaim.count.mockResolvedValue(2) // 2 other active claims

      await rejectSubmission({
        prisma: mockPrisma as any,
        submissionId: 'sub-1',
        actorId: 'founder-1',
        note: 'Rejected',
      })

      // Should NOT update bounty status
      expect(mockPrisma.bounty.update).not.toHaveBeenCalled()
    })
  })
})

// ================================
// updateBountyStatusOnClaimResolution Tests
// ================================

describe('updateBountyStatusOnClaimResolution', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  test('reopens bounty to OPEN when no active claims remain', async () => {
    mockPrisma.bounty.findUnique.mockResolvedValue({
      status: BountyStatus.CLAIMED,
    })
    mockPrisma.bountyClaim.count.mockResolvedValue(0)
    mockPrisma.bounty.update.mockResolvedValue({})

    await updateBountyStatusOnClaimResolution({
      prisma: mockPrisma as any,
      bountyId: 'bounty-1',
      claimMode: BountyClaimMode.SINGLE,
    })

    expect(mockPrisma.bounty.update).toHaveBeenCalledWith({
      where: { id: 'bounty-1' },
      data: { status: BountyStatus.OPEN },
    })
  })

  test('does NOT change status when active claims remain', async () => {
    mockPrisma.bounty.findUnique.mockResolvedValue({
      status: BountyStatus.CLAIMED,
    })
    mockPrisma.bountyClaim.count.mockResolvedValue(1) // 1 active claim

    await updateBountyStatusOnClaimResolution({
      prisma: mockPrisma as any,
      bountyId: 'bounty-1',
      claimMode: BountyClaimMode.SINGLE,
    })

    expect(mockPrisma.bounty.update).not.toHaveBeenCalled()
  })

  test('does NOT change status when bounty is not CLAIMED', async () => {
    mockPrisma.bounty.findUnique.mockResolvedValue({
      status: BountyStatus.COMPLETED,
    })

    await updateBountyStatusOnClaimResolution({
      prisma: mockPrisma as any,
      bountyId: 'bounty-1',
      claimMode: BountyClaimMode.SINGLE,
    })

    // Should not even count claims if bounty isn't CLAIMED
    expect(mockPrisma.bountyClaim.count).not.toHaveBeenCalled()
    expect(mockPrisma.bounty.update).not.toHaveBeenCalled()
  })

  test('does NOT change status when bounty not found', async () => {
    mockPrisma.bounty.findUnique.mockResolvedValue(null)

    await updateBountyStatusOnClaimResolution({
      prisma: mockPrisma as any,
      bountyId: 'bounty-1',
      claimMode: BountyClaimMode.SINGLE,
    })

    expect(mockPrisma.bountyClaim.count).not.toHaveBeenCalled()
    expect(mockPrisma.bounty.update).not.toHaveBeenCalled()
  })
})

// ================================
// Integration-style Tests for Claim Mode Matrix
// ================================

describe('Claim Mode Behavior Matrix', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  /**
   * Test the full claim mode behavior matrix:
   *
   * | Mode        | Multi Submit | Expire Others | Complete On |
   * |-------------|--------------|---------------|-------------|
   * | SINGLE      | ❌           | ❌            | 1st approval |
   * | COMPETITIVE | ❌           | ✅            | 1st approval |
   * | MULTIPLE    | ✅           | ❌            | maxClaims reached |
   * | PERFORMANCE | ✅           | ❌            | Never (manual) |
   */

  describe('submission creation per mode', () => {
    test.each([
      { mode: BountyClaimMode.SINGLE, allowsMultiple: false },
      { mode: BountyClaimMode.COMPETITIVE, allowsMultiple: false },
      { mode: BountyClaimMode.MULTIPLE, allowsMultiple: true },
      { mode: BountyClaimMode.PERFORMANCE, allowsMultiple: true },
    ])(
      '$mode mode allowsMultipleSubmissionsPerUser = $allowsMultiple',
      async ({ mode, allowsMultiple }) => {
        mockPrisma.bounty.findUnique.mockResolvedValue({
          id: 'bounty-1',
          claimMode: mode,
          project: { founderId: 'founder-1' },
        })
        mockPrisma.bountyClaim.findFirst.mockResolvedValue({
          id: 'claim-1',
          status: ClaimStatus.ACTIVE,
        })

        if (allowsMultiple) {
          // Should NOT check for existing submissions
          mockPrisma.submission.create.mockResolvedValue({ id: 'sub-1' })
          mockPrisma.bountyClaim.update.mockResolvedValue({})

          await createSubmission({
            prisma: mockPrisma as any,
            bountyId: 'bounty-1',
            userId: 'user-1',
            description: 'Work',
          })

          expect(mockPrisma.submission.findFirst).not.toHaveBeenCalled()
        } else {
          // Should check for existing submissions
          mockPrisma.submission.findFirst.mockResolvedValue({
            id: 'existing',
            status: SubmissionStatus.PENDING,
          })

          const result = await createSubmission({
            prisma: mockPrisma as any,
            bountyId: 'bounty-1',
            userId: 'user-1',
            description: 'Work',
          })

          expect(mockPrisma.submission.findFirst).toHaveBeenCalled()
          expect(result.success).toBe(false)
        }
      },
    )
  })
})
