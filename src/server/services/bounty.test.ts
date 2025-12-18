/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BountyClaimMode,
  BountyStatus,
  ClaimStatus,
  SubmissionStatus,
} from '@/lib/db/types'
import {
  claimBounty,
  closeBounty,
  createBounty,
  releaseClaim,
  reopenBounty,
  updateBounty,
} from './bounty'
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

function createMockPrisma() {
  return {
    bounty: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bountyClaim: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    submission: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    submissionEvent: {
      create: vi.fn(),
    },
    bountyEvent: {
      create: vi.fn(),
    },
    bountyLabel: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  }
}

// ================================
// claimBounty Tests
// ================================

describe('claimBounty', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns NOT_FOUND when bounty does not exist', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue(null)

      const result = await claimBounty({
        prisma: mockPrisma as any,
        bountyId: 'non-existent',
        userId: 'user-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    test('returns BACKLOG when bounty is in backlog', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.BACKLOG,
        project: { founderId: 'founder-1' },
        claims: [],
      })

      const result = await claimBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('BACKLOG')
      }
    })

    test('returns COMPLETED when bounty is completed', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.COMPLETED,
        project: { founderId: 'founder-1' },
        claims: [],
      })

      const result = await claimBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('COMPLETED')
      }
    })

    test('returns CLOSED when bounty is closed', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.CLOSED,
        project: { founderId: 'founder-1' },
        claims: [],
      })

      const result = await claimBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('CLOSED')
      }
    })

    test('returns ALREADY_CLAIMED_BY_USER when user has active claim', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.OPEN,
        claimMode: BountyClaimMode.MULTIPLE,
        project: { founderId: 'founder-1' },
        claims: [],
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        userId: 'user-1',
        status: ClaimStatus.ACTIVE,
      })

      const result = await claimBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('ALREADY_CLAIMED_BY_USER')
      }
    })

    test('returns ALREADY_CLAIMED_SINGLE for SINGLE mode when already claimed', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.CLAIMED,
        claimMode: BountyClaimMode.SINGLE,
        project: { founderId: 'founder-1' },
        claims: [{ id: 'claim-1', status: ClaimStatus.ACTIVE }],
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue(null)

      const result = await claimBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-2',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('ALREADY_CLAIMED_SINGLE')
      }
    })

    test('returns MAX_CLAIMS_REACHED when maxClaims limit hit', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.CLAIMED,
        claimMode: BountyClaimMode.COMPETITIVE,
        maxClaims: 2,
        project: { founderId: 'founder-1' },
        claims: [
          { id: 'claim-1', status: ClaimStatus.ACTIVE },
          { id: 'claim-2', status: ClaimStatus.ACTIVE },
        ],
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue(null)

      const result = await claimBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-3',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('MAX_CLAIMS_REACHED')
      }
    })
  })

  describe('success cases', () => {
    test('creates claim for OPEN bounty in SINGLE mode', async () => {
      const now = new Date()
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.OPEN,
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        project: { founderId: 'founder-1' },
        claims: [],
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue(null)
      mockPrisma.bountyClaim.create.mockResolvedValue({
        id: 'new-claim-1',
        expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      })
      mockPrisma.bounty.update.mockResolvedValue({})

      const result = await claimBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.claim.id).toBe('new-claim-1')
      }
      expect(mockPrisma.bounty.update).toHaveBeenCalledWith({
        where: { id: 'bounty-1' },
        data: { status: BountyStatus.CLAIMED },
      })
    })

    test('creates claim for CLAIMED bounty in COMPETITIVE mode (allows multiple)', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.CLAIMED,
        claimMode: BountyClaimMode.COMPETITIVE,
        claimExpiryDays: 7,
        maxClaims: 5,
        project: { founderId: 'founder-1' },
        claims: [{ id: 'claim-1', status: ClaimStatus.ACTIVE }],
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue(null)
      mockPrisma.bountyClaim.create.mockResolvedValue({
        id: 'new-claim-2',
        expiresAt: new Date(),
      })

      const result = await claimBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-2',
      })

      expect(result.success).toBe(true)
      // Should NOT update bounty status since it's already CLAIMED
      expect(mockPrisma.bounty.update).not.toHaveBeenCalled()
    })

    test('creates claim with correct expiry based on claimExpiryDays', async () => {
      const claimExpiryDays = 21
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.OPEN,
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays,
        project: { founderId: 'founder-1' },
        claims: [],
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue(null)
      mockPrisma.bountyClaim.create.mockImplementation(({ data }) => {
        return Promise.resolve({
          id: 'new-claim',
          expiresAt: data.expiresAt,
        })
      })
      mockPrisma.bounty.update.mockResolvedValue({})

      const beforeCall = new Date()
      const result = await claimBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
      })
      const afterCall = new Date()

      expect(result.success).toBe(true)
      if (result.success) {
        const expiryDate = result.claim.expiresAt
        const expectedMinExpiry = new Date(beforeCall)
        expectedMinExpiry.setDate(expectedMinExpiry.getDate() + claimExpiryDays)
        const expectedMaxExpiry = new Date(afterCall)
        expectedMaxExpiry.setDate(expectedMaxExpiry.getDate() + claimExpiryDays)

        expect(expiryDate.getTime()).toBeGreaterThanOrEqual(
          expectedMinExpiry.getTime(),
        )
        expect(expiryDate.getTime()).toBeLessThanOrEqual(
          expectedMaxExpiry.getTime(),
        )
      }
    })
  })

  describe('claim mode behaviors', () => {
    test.each([
      { mode: BountyClaimMode.COMPETITIVE, canClaimWhenClaimed: true },
      { mode: BountyClaimMode.MULTIPLE, canClaimWhenClaimed: true },
      { mode: BountyClaimMode.PERFORMANCE, canClaimWhenClaimed: true },
    ])(
      '$mode mode allows claiming when status is CLAIMED',
      async ({ mode, canClaimWhenClaimed }) => {
        mockPrisma.bounty.findUnique.mockResolvedValue({
          id: 'bounty-1',
          status: BountyStatus.CLAIMED,
          claimMode: mode,
          claimExpiryDays: 14,
          maxClaims: null,
          project: { founderId: 'founder-1' },
          claims: [{ id: 'existing-claim', status: ClaimStatus.ACTIVE }],
        })
        mockPrisma.bountyClaim.findFirst.mockResolvedValue(null)
        mockPrisma.bountyClaim.create.mockResolvedValue({
          id: 'new-claim',
          expiresAt: new Date(),
        })

        const result = await claimBounty({
          prisma: mockPrisma as any,
          bountyId: 'bounty-1',
          userId: 'new-user',
        })

        expect(result.success).toBe(canClaimWhenClaimed)
      },
    )
  })
})

// ================================
// releaseClaim Tests
// ================================

describe('releaseClaim', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns NOT_FOUND when claim does not exist', async () => {
      mockPrisma.bountyClaim.findUnique.mockResolvedValue(null)

      const result = await releaseClaim({
        prisma: mockPrisma as any,
        claimId: 'non-existent',
        userId: 'user-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    test('returns FORBIDDEN when user is not claimant or founder', async () => {
      mockPrisma.bountyClaim.findUnique.mockResolvedValue({
        id: 'claim-1',
        userId: 'claimant-user',
        bounty: {
          project: { founderId: 'founder-user' },
          claimMode: BountyClaimMode.SINGLE,
          status: BountyStatus.CLAIMED,
        },
        bountyId: 'bounty-1',
      })

      const result = await releaseClaim({
        prisma: mockPrisma as any,
        claimId: 'claim-1',
        userId: 'random-user',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })
  })

  describe('success cases', () => {
    test('claimant can release their own claim', async () => {
      mockPrisma.bountyClaim.findUnique.mockResolvedValue({
        id: 'claim-1',
        userId: 'user-1',
        bountyId: 'bounty-1',
        bounty: {
          id: 'bounty-1',
          project: { founderId: 'founder-1' },
          claimMode: BountyClaimMode.SINGLE,
          status: BountyStatus.CLAIMED,
        },
      })
      mockPrisma.bountyClaim.update.mockResolvedValue({})
      mockPrisma.submission.findMany.mockResolvedValue([])
      mockPrisma.bountyClaim.count.mockResolvedValue(0)
      mockPrisma.bounty.update.mockResolvedValue({})

      const result = await releaseClaim({
        prisma: mockPrisma as any,
        claimId: 'claim-1',
        userId: 'user-1',
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.bountyClaim.update).toHaveBeenCalledWith({
        where: { id: 'claim-1' },
        data: { status: ClaimStatus.RELEASED },
      })
    })

    test('founder can release any claim', async () => {
      mockPrisma.bountyClaim.findUnique.mockResolvedValue({
        id: 'claim-1',
        userId: 'contributor-1',
        bountyId: 'bounty-1',
        bounty: {
          id: 'bounty-1',
          project: { founderId: 'founder-1' },
          claimMode: BountyClaimMode.SINGLE,
          status: BountyStatus.CLAIMED,
        },
      })
      mockPrisma.bountyClaim.update.mockResolvedValue({})
      mockPrisma.submission.findMany.mockResolvedValue([])
      mockPrisma.bountyClaim.count.mockResolvedValue(0)
      mockPrisma.bounty.update.mockResolvedValue({})

      const result = await releaseClaim({
        prisma: mockPrisma as any,
        claimId: 'claim-1',
        userId: 'founder-1',
      })

      expect(result.success).toBe(true)
    })

    test('skipAuthCheck allows system to release claim', async () => {
      mockPrisma.bountyClaim.findUnique.mockResolvedValue({
        id: 'claim-1',
        userId: 'contributor-1',
        bountyId: 'bounty-1',
        bounty: {
          id: 'bounty-1',
          project: { founderId: 'founder-1' },
          claimMode: BountyClaimMode.SINGLE,
          status: BountyStatus.CLAIMED,
        },
      })
      mockPrisma.bountyClaim.update.mockResolvedValue({})
      mockPrisma.submission.findMany.mockResolvedValue([])
      mockPrisma.bountyClaim.count.mockResolvedValue(0)
      mockPrisma.bounty.update.mockResolvedValue({})

      const result = await releaseClaim({
        prisma: mockPrisma as any,
        claimId: 'claim-1',
        userId: 'system', // Not claimant or founder
        skipAuthCheck: true,
      })

      expect(result.success).toBe(true)
    })

    test('withdraws pending submissions when claim is released', async () => {
      mockPrisma.bountyClaim.findUnique.mockResolvedValue({
        id: 'claim-1',
        userId: 'user-1',
        bountyId: 'bounty-1',
        bounty: {
          id: 'bounty-1',
          project: { founderId: 'founder-1' },
          claimMode: BountyClaimMode.SINGLE,
          status: BountyStatus.CLAIMED,
        },
      })
      mockPrisma.bountyClaim.update.mockResolvedValue({})
      mockPrisma.submission.findMany.mockResolvedValue([
        { id: 'sub-1', status: SubmissionStatus.PENDING },
        { id: 'sub-2', status: SubmissionStatus.DRAFT },
      ])
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.bountyClaim.count.mockResolvedValue(0)
      mockPrisma.bounty.update.mockResolvedValue({})

      await releaseClaim({
        prisma: mockPrisma as any,
        claimId: 'claim-1',
        userId: 'user-1',
        reason: 'Changed my mind',
      })

      expect(mockPrisma.submission.update).toHaveBeenCalledTimes(2)
      expect(mockPrisma.submissionEvent.create).toHaveBeenCalledTimes(2)
    })

    test('reopens SINGLE mode bounty when last claim released', async () => {
      mockPrisma.bountyClaim.findUnique.mockResolvedValue({
        id: 'claim-1',
        userId: 'user-1',
        bountyId: 'bounty-1',
        bounty: {
          id: 'bounty-1',
          project: { founderId: 'founder-1' },
          claimMode: BountyClaimMode.SINGLE,
          status: BountyStatus.CLAIMED,
        },
      })
      mockPrisma.bountyClaim.update.mockResolvedValue({})
      mockPrisma.submission.findMany.mockResolvedValue([])
      mockPrisma.bountyClaim.count.mockResolvedValue(0) // No remaining claims

      await releaseClaim({
        prisma: mockPrisma as any,
        claimId: 'claim-1',
        userId: 'user-1',
      })

      expect(mockPrisma.bounty.update).toHaveBeenCalledWith({
        where: { id: 'bounty-1' },
        data: { status: BountyStatus.OPEN },
      })
    })

    test('does NOT reopen COMPETITIVE mode bounty when claim released', async () => {
      mockPrisma.bountyClaim.findUnique.mockResolvedValue({
        id: 'claim-1',
        userId: 'user-1',
        bountyId: 'bounty-1',
        bounty: {
          id: 'bounty-1',
          project: { founderId: 'founder-1' },
          claimMode: BountyClaimMode.COMPETITIVE,
          status: BountyStatus.CLAIMED,
        },
      })
      mockPrisma.bountyClaim.update.mockResolvedValue({})
      mockPrisma.submission.findMany.mockResolvedValue([])

      await releaseClaim({
        prisma: mockPrisma as any,
        claimId: 'claim-1',
        userId: 'user-1',
      })

      // Should not check remaining claims or update bounty for COMPETITIVE
      expect(mockPrisma.bountyClaim.count).not.toHaveBeenCalled()
      expect(mockPrisma.bounty.update).not.toHaveBeenCalled()
    })
  })
})

// ================================
// createBounty Tests
// ================================

describe('createBounty', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns NOT_FOUND when project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null)

      const result = await createBounty({
        prisma: mockPrisma as any,
        projectId: 'non-existent',
        userId: 'user-1',
        title: 'Test Bounty',
        description: 'Description',
        points: 100,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    test('returns FORBIDDEN when user is not founder', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        founderId: 'founder-1',
        rewardPool: { id: 'pool-1' },
      })

      const result = await createBounty({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'not-founder',
        title: 'Test Bounty',
        description: 'Description',
        points: 100,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })

    test('returns NO_REWARD_POOL when project has no pool', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        founderId: 'founder-1',
        rewardPool: null,
      })

      const result = await createBounty({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        title: 'Test Bounty',
        description: 'Description',
        points: 100,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NO_REWARD_POOL')
      }
    })
  })

  describe('success cases', () => {
    test('creates OPEN bounty when points provided', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        founderId: 'founder-1',
        rewardPool: { id: 'pool-1' },
      })
      mockPrisma.project.update.mockResolvedValue({ nextBountyNumber: 2 })
      mockPrisma.bounty.create.mockResolvedValue({
        id: 'bounty-1',
        number: 1,
        status: BountyStatus.OPEN,
        title: 'Test Bounty',
        description: 'Description',
        points: 100,
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
        evidenceDescription: null,
      })

      const result = await createBounty({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        title: 'Test Bounty',
        description: 'Description',
        points: 100,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.bounty.status).toBe(BountyStatus.OPEN)
        expect(result.bounty.points).toBe(100)
      }
    })

    test('creates BACKLOG bounty when points is null', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        founderId: 'founder-1',
        rewardPool: { id: 'pool-1' },
      })
      mockPrisma.project.update.mockResolvedValue({ nextBountyNumber: 2 })
      mockPrisma.bounty.create.mockResolvedValue({
        id: 'bounty-1',
        number: 1,
        status: BountyStatus.BACKLOG,
        title: 'Test Bounty',
        description: 'Description',
        points: null,
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
        evidenceDescription: null,
      })

      const result = await createBounty({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        title: 'Test Bounty',
        description: 'Description',
        points: null,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.bounty.status).toBe(BountyStatus.BACKLOG)
        expect(result.bounty.points).toBe(null)
      }
    })

    test('creates bounty with custom claim mode and expiry', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        founderId: 'founder-1',
        rewardPool: { id: 'pool-1' },
      })
      mockPrisma.project.update.mockResolvedValue({ nextBountyNumber: 2 })
      mockPrisma.bounty.create.mockResolvedValue({
        id: 'bounty-1',
        number: 1,
        status: BountyStatus.OPEN,
        title: 'Competitive Bounty',
        description: 'Description',
        points: 50,
        claimMode: BountyClaimMode.COMPETITIVE,
        claimExpiryDays: 7,
        maxClaims: 5,
        evidenceDescription: 'Must provide proof',
      })

      const result = await createBounty({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        title: 'Competitive Bounty',
        description: 'Description',
        points: 50,
        claimMode: BountyClaimMode.COMPETITIVE,
        claimExpiryDays: 7,
        maxClaims: 5,
        evidenceDescription: 'Must provide proof',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.bounty.claimMode).toBe(BountyClaimMode.COMPETITIVE)
        expect(result.bounty.claimExpiryDays).toBe(7)
        expect(result.bounty.maxClaims).toBe(5)
      }
    })

    test('creates bounty labels when labelIds provided', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        founderId: 'founder-1',
        rewardPool: { id: 'pool-1' },
      })
      mockPrisma.project.update.mockResolvedValue({ nextBountyNumber: 2 })
      mockPrisma.bounty.create.mockResolvedValue({
        id: 'bounty-1',
        number: 1,
        status: BountyStatus.OPEN,
        title: 'Test',
        description: 'Desc',
        points: 100,
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
        evidenceDescription: null,
      })
      mockPrisma.bountyLabel.createMany.mockResolvedValue({ count: 2 })

      await createBounty({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        title: 'Test',
        description: 'Desc',
        points: 100,
        labelIds: ['label-1', 'label-2'],
      })

      expect(mockPrisma.bountyLabel.createMany).toHaveBeenCalledWith({
        data: [
          { bountyId: 'bounty-1', labelId: 'label-1' },
          { bountyId: 'bounty-1', labelId: 'label-2' },
        ],
      })
    })
  })
})

// ================================
// updateBounty Tests
// ================================

describe('updateBounty', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns NOT_FOUND when bounty does not exist', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue(null)

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'non-existent',
        userId: 'user-1',
        data: { title: 'New Title' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    test('returns FORBIDDEN when user is not founder', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Old Title',
        project: { founderId: 'founder-1' },
        labels: [],
      })

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'not-founder',
        data: { title: 'New Title' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })

    test('returns NO_CHANGES when nothing changed', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Same Title',
        description: 'Same Desc',
        project: { founderId: 'founder-1' },
        labels: [],
      })

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
        data: { title: 'Same Title' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NO_CHANGES')
      }
    })

    test('returns INVALID_POINTS_CHANGE for completed bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        points: 100,
        status: BountyStatus.COMPLETED,
        project: { founderId: 'founder-1' },
        labels: [],
      })

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
        data: { points: 200 },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('INVALID_POINTS_CHANGE')
      }
    })

    test('returns INVALID_POINTS_CHANGE when removing points from claimed bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        points: 100,
        status: BountyStatus.CLAIMED,
        project: { founderId: 'founder-1' },
        labels: [],
      })

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
        data: { points: null },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('INVALID_POINTS_CHANGE')
      }
    })
  })

  describe('success cases', () => {
    test('updates basic fields', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Old Title',
        description: 'Old Desc',
        evidenceDescription: null,
        points: 100,
        status: BountyStatus.OPEN,
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
        project: { founderId: 'founder-1' },
        labels: [],
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        title: 'New Title',
        description: 'New Desc',
        evidenceDescription: null,
        points: 100,
        status: BountyStatus.OPEN,
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
        data: { title: 'New Title', description: 'New Desc' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.bounty.title).toBe('New Title')
        expect(result.changes).toHaveProperty('title')
        expect(result.changes).toHaveProperty('description')
      }
    })

    test('auto-transitions from BACKLOG to OPEN when points assigned', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'Desc',
        points: null,
        status: BountyStatus.BACKLOG,
        project: { founderId: 'founder-1' },
        labels: [],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
        evidenceDescription: null,
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'Desc',
        points: 100,
        status: BountyStatus.OPEN,
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
        evidenceDescription: null,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
        data: { points: 100 },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.changes.status).toEqual({
          from: BountyStatus.BACKLOG,
          to: BountyStatus.OPEN,
        })
      }
    })

    test('auto-transitions from OPEN to BACKLOG when points removed', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'Desc',
        points: 100,
        status: BountyStatus.OPEN,
        project: { founderId: 'founder-1' },
        labels: [],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
        evidenceDescription: null,
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'Desc',
        points: null,
        status: BountyStatus.BACKLOG,
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
        evidenceDescription: null,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
        data: { points: null },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.changes.status).toEqual({
          from: BountyStatus.OPEN,
          to: BountyStatus.BACKLOG,
        })
      }
    })

    test('updates labels when labelIds provided', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'Desc',
        points: 100,
        status: BountyStatus.OPEN,
        project: { founderId: 'founder-1' },
        labels: [{ labelId: 'old-label' }],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
        evidenceDescription: null,
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'Desc',
        points: 100,
        status: BountyStatus.OPEN,
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
        evidenceDescription: null,
      })
      mockPrisma.bountyLabel.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.bountyLabel.createMany.mockResolvedValue({ count: 2 })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
        data: { labelIds: ['new-label-1', 'new-label-2'] },
      })

      expect(mockPrisma.bountyLabel.deleteMany).toHaveBeenCalledWith({
        where: { bountyId: 'bounty-1' },
      })
      expect(mockPrisma.bountyLabel.createMany).toHaveBeenCalled()
    })
  })
})

// ================================
// closeBounty Tests
// ================================

describe('closeBounty', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns NOT_FOUND when bounty does not exist', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue(null)

      const result = await closeBounty({
        prisma: mockPrisma as any,
        bountyId: 'non-existent',
        userId: 'user-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    test('returns FORBIDDEN when user is not founder', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.OPEN,
        project: { founderId: 'founder-1' },
        claims: [],
        submissions: [],
      })

      const result = await closeBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'not-founder',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })

    test('returns ALREADY_COMPLETED for completed bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.COMPLETED,
        project: { founderId: 'founder-1' },
        claims: [],
        submissions: [],
      })

      const result = await closeBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('ALREADY_COMPLETED')
      }
    })

    test('returns ALREADY_CLOSED for already closed bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.CLOSED,
        project: { founderId: 'founder-1' },
        claims: [],
        submissions: [],
      })

      const result = await closeBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('ALREADY_CLOSED')
      }
    })
  })

  describe('success cases', () => {
    test('closes bounty and expires active claims', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.CLAIMED,
        project: { founderId: 'founder-1' },
        claims: [
          { id: 'claim-1', userId: 'user-1', status: ClaimStatus.ACTIVE },
        ],
        submissions: [],
      })
      mockPrisma.bountyClaim.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.CLOSED,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      const result = await closeBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
        reason: 'No longer needed',
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.bountyClaim.updateMany).toHaveBeenCalledWith({
        where: {
          bountyId: 'bounty-1',
          status: { in: [ClaimStatus.ACTIVE, ClaimStatus.SUBMITTED] },
        },
        data: { status: ClaimStatus.EXPIRED },
      })
    })

    test('closes bounty and withdraws pending submissions', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.CLAIMED,
        project: { founderId: 'founder-1' },
        claims: [],
        submissions: [
          { id: 'sub-1', status: SubmissionStatus.PENDING, userId: 'user-1' },
        ],
      })
      mockPrisma.submission.update.mockResolvedValue({})
      mockPrisma.submissionEvent.create.mockResolvedValue({})
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.CLOSED,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      await closeBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
      })

      expect(mockPrisma.submission.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { status: SubmissionStatus.WITHDRAWN },
      })
      expect(mockPrisma.submissionEvent.create).toHaveBeenCalled()
    })
  })
})

// ================================
// reopenBounty Tests
// ================================

describe('reopenBounty', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns NOT_FOUND when bounty does not exist', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue(null)

      const result = await reopenBounty({
        prisma: mockPrisma as any,
        bountyId: 'non-existent',
        userId: 'user-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    test('returns FORBIDDEN when user is not founder', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.CLOSED,
        project: { founderId: 'founder-1' },
      })

      const result = await reopenBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'not-founder',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })

    test('returns NOT_CLOSED for non-closed bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.OPEN,
        project: { founderId: 'founder-1' },
      })

      const result = await reopenBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_CLOSED')
      }
    })
  })

  describe('success cases', () => {
    test('reopens to OPEN when bounty has points', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.CLOSED,
        points: 100,
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.OPEN,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      const result = await reopenBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.bounty.status).toBe(BountyStatus.OPEN)
      }
    })

    test('reopens to BACKLOG when bounty has no points', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.CLOSED,
        points: null,
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.BACKLOG,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      const result = await reopenBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.bounty.status).toBe(BountyStatus.BACKLOG)
      }
    })
  })
})
