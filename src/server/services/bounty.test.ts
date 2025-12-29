/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BountyClaimMode,
  BountyStatus,
  ClaimStatus,
  SubmissionStatus,
} from '@/lib/db/types'
import {
  approveSuggestion,
  claimBounty,
  closeBounty,
  createBounty,
  rejectSuggestion,
  releaseClaim,
  reopenBounty,
  suggestBounty,
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

// Mock the contributor agreement service
vi.mock('@/server/services/contributor-agreement', () => ({
  checkAgreement: vi.fn().mockResolvedValue({ requiresAcceptance: false }),
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
    attachment: {
      updateMany: vi.fn(),
    },
  }
}

// Helper to get mocked contributor agreement module
async function getMockedCheckAgreement() {
  const agreementModule =
    await import('@/server/services/contributor-agreement')
  return agreementModule.checkAgreement as ReturnType<typeof vi.fn>
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
        projectId: 'project-1',
        project: {
          id: 'project-1',
          founderId: 'founder-1',
          contributorTermsEnabled: true,
          projectOwnerLegalName: 'Test LLC',
          projectOwnerContactEmail: 'owner@example.com',
        },
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
        projectId: 'project-1',
        project: {
          id: 'project-1',
          founderId: 'founder-1',
          contributorTermsEnabled: true,
          projectOwnerLegalName: 'Test LLC',
          projectOwnerContactEmail: 'owner@example.com',
        },
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
        projectId: 'project-1',
        project: {
          id: 'project-1',
          founderId: 'founder-1',
          contributorTermsEnabled: true,
          projectOwnerLegalName: 'Test LLC',
          projectOwnerContactEmail: 'owner@example.com',
        },
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
        projectId: 'project-1',
        project: {
          id: 'project-1',
          founderId: 'founder-1',
          contributorTermsEnabled: true,
          projectOwnerLegalName: 'Test LLC',
          projectOwnerContactEmail: 'owner@example.com',
        },
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
        projectId: 'project-1',
        project: {
          id: 'project-1',
          founderId: 'founder-1',
          contributorTermsEnabled: true,
          projectOwnerLegalName: 'Test LLC',
          projectOwnerContactEmail: 'owner@example.com',
        },
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
        projectId: 'project-1',
        project: {
          id: 'project-1',
          founderId: 'founder-1',
          contributorTermsEnabled: true,
          projectOwnerLegalName: 'Test LLC',
          projectOwnerContactEmail: 'owner@example.com',
        },
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

    test('returns BACKLOG when bounty is SUGGESTED', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.SUGGESTED,
        projectId: 'project-1',
        project: {
          id: 'project-1',
          founderId: 'founder-1',
          contributorTermsEnabled: true,
          projectOwnerLegalName: 'Test LLC',
          projectOwnerContactEmail: 'owner@example.com',
        },
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
        expect(result.message).toContain('pending approval')
      }
    })

    test('returns AGREEMENT_NOT_CONFIGURED when terms not properly set up', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.OPEN,
        projectId: 'project-1',
        project: {
          id: 'project-1',
          founderId: 'founder-1',
          contributorTermsEnabled: true,
          projectOwnerLegalName: null, // Not configured
          projectOwnerContactEmail: null,
        },
        claims: [],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
      })

      const result = await claimBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1', // Not the founder
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('AGREEMENT_NOT_CONFIGURED')
        expect(result.message).toContain('not configured')
      }
    })

    test('returns AGREEMENT_REQUIRED when user has not accepted agreement', async () => {
      const mockCheckAgreement = await getMockedCheckAgreement()
      mockCheckAgreement.mockResolvedValueOnce({ requiresAcceptance: true })

      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.OPEN,
        projectId: 'project-1',
        project: {
          id: 'project-1',
          founderId: 'founder-1',
          contributorTermsEnabled: true,
          projectOwnerLegalName: 'Test LLC',
          projectOwnerContactEmail: 'owner@example.com',
        },
        claims: [],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
      })

      const result = await claimBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'user-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('AGREEMENT_REQUIRED')
        expect(result.message).toContain('contributor agreement')
        expect((result as any).projectId).toBe('project-1')
      }
    })

    test('skips agreement check for founder claiming their own bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.OPEN,
        projectId: 'project-1',
        project: {
          id: 'project-1',
          founderId: 'founder-1',
          contributorTermsEnabled: true,
          projectOwnerLegalName: 'Test LLC',
          projectOwnerContactEmail: 'owner@example.com',
        },
        claims: [],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
      })
      mockPrisma.bountyClaim.findFirst.mockResolvedValue(null)
      mockPrisma.bountyClaim.create.mockResolvedValue({
        id: 'claim-1',
        expiresAt: new Date(),
      })
      mockPrisma.bounty.update.mockResolvedValue({})

      // Founder claiming their own bounty
      const result = await claimBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
      })

      // Should succeed without checking agreement
      expect(result.success).toBe(true)
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
        projectId: 'project-1',
        project: {
          id: 'project-1',
          founderId: 'founder-1',
          contributorTermsEnabled: true,
          projectOwnerLegalName: 'Test LLC',
          projectOwnerContactEmail: 'owner@example.com',
        },
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
        projectId: 'project-1',
        project: {
          id: 'project-1',
          founderId: 'founder-1',
          contributorTermsEnabled: true,
          projectOwnerLegalName: 'Test LLC',
          projectOwnerContactEmail: 'owner@example.com',
        },
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
        projectId: 'project-1',
        project: {
          id: 'project-1',
          founderId: 'founder-1',
          contributorTermsEnabled: true,
          projectOwnerLegalName: 'Test LLC',
          projectOwnerContactEmail: 'owner@example.com',
        },
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
          projectId: 'project-1',
          project: {
            id: 'project-1',
            founderId: 'founder-1',
            contributorTermsEnabled: true,
            projectOwnerLegalName: 'Test LLC',
            projectOwnerContactEmail: 'owner@example.com',
          },
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

  describe('suggester updates', () => {
    test('suggester can update title of their own SUGGESTED bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Old Title',
        description: 'Desc',
        evidenceDescription: null,
        points: null,
        status: BountyStatus.SUGGESTED,
        suggestedById: 'suggester-1',
        project: { founderId: 'founder-1' },
        labels: [],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        title: 'New Title',
        description: 'Desc',
        evidenceDescription: null,
        points: null,
        status: BountyStatus.SUGGESTED,
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'suggester-1',
        data: { title: 'New Title' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.bounty.title).toBe('New Title')
      }
    })

    test('suggester can update description of their own SUGGESTED bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'Old Desc',
        evidenceDescription: null,
        points: null,
        status: BountyStatus.SUGGESTED,
        suggestedById: 'suggester-1',
        project: { founderId: 'founder-1' },
        labels: [],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'New Desc',
        evidenceDescription: null,
        points: null,
        status: BountyStatus.SUGGESTED,
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'suggester-1',
        data: { description: 'New Desc' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.bounty.description).toBe('New Desc')
      }
    })

    test('suggester can update evidenceDescription of their own SUGGESTED bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'Desc',
        evidenceDescription: null,
        points: null,
        status: BountyStatus.SUGGESTED,
        suggestedById: 'suggester-1',
        project: { founderId: 'founder-1' },
        labels: [],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'Desc',
        evidenceDescription: 'Provide screenshots',
        points: null,
        status: BountyStatus.SUGGESTED,
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'suggester-1',
        data: { evidenceDescription: 'Provide screenshots' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.bounty.evidenceDescription).toBe('Provide screenshots')
      }
    })

    test('suggester cannot update points on their SUGGESTED bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'Desc',
        evidenceDescription: null,
        points: null,
        status: BountyStatus.SUGGESTED,
        suggestedById: 'suggester-1',
        project: { founderId: 'founder-1' },
        labels: [],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
      })

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'suggester-1',
        data: { points: 100 },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
        expect(result.message).toContain('points')
      }
    })

    test('suggester cannot update status on their SUGGESTED bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'Desc',
        evidenceDescription: null,
        points: null,
        status: BountyStatus.SUGGESTED,
        suggestedById: 'suggester-1',
        project: { founderId: 'founder-1' },
        labels: [],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
      })

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'suggester-1',
        data: { status: BountyStatus.OPEN },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
        expect(result.message).toContain('status')
      }
    })

    test('suggester cannot update labelIds on their SUGGESTED bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'Desc',
        evidenceDescription: null,
        points: null,
        status: BountyStatus.SUGGESTED,
        suggestedById: 'suggester-1',
        project: { founderId: 'founder-1' },
        labels: [],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
      })

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'suggester-1',
        data: { labelIds: ['label-1'] },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
        expect(result.message).toContain('labelIds')
      }
    })

    test('suggester cannot update claimMode on their SUGGESTED bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'Desc',
        evidenceDescription: null,
        points: null,
        status: BountyStatus.SUGGESTED,
        suggestedById: 'suggester-1',
        project: { founderId: 'founder-1' },
        labels: [],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
      })

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'suggester-1',
        data: { claimMode: BountyClaimMode.COMPETITIVE },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
        expect(result.message).toContain('claimMode')
      }
    })

    test('suggester cannot update another users SUGGESTED bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'Desc',
        evidenceDescription: null,
        points: null,
        status: BountyStatus.SUGGESTED,
        suggestedById: 'other-suggester',
        project: { founderId: 'founder-1' },
        labels: [],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
      })

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'suggester-1',
        data: { title: 'Hacked Title' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })

    test('suggester cannot update their bounty after it is approved (OPEN status)', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Title',
        description: 'Desc',
        evidenceDescription: null,
        points: 100,
        status: BountyStatus.OPEN,
        suggestedById: 'suggester-1',
        project: { founderId: 'founder-1' },
        labels: [],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
      })

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'suggester-1',
        data: { title: 'New Title' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })

    test('founder can still update all fields on SUGGESTED bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        title: 'Old Title',
        description: 'Desc',
        evidenceDescription: null,
        points: null,
        status: BountyStatus.SUGGESTED,
        suggestedById: 'suggester-1',
        project: { founderId: 'founder-1' },
        labels: [],
        claimMode: BountyClaimMode.SINGLE,
        claimExpiryDays: 14,
        maxClaims: null,
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        title: 'New Title',
        description: 'Desc',
        evidenceDescription: null,
        points: 100,
        status: BountyStatus.OPEN,
        claimMode: BountyClaimMode.COMPETITIVE,
        claimExpiryDays: 7,
        maxClaims: 5,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      const result = await updateBounty({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
        data: {
          title: 'New Title',
          points: 100,
          status: BountyStatus.OPEN,
          claimMode: BountyClaimMode.COMPETITIVE,
          claimExpiryDays: 7,
          maxClaims: 5,
        },
      })

      expect(result.success).toBe(true)
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

// ================================
// suggestBounty Tests
// ================================

describe('suggestBounty', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns NOT_FOUND when project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null)

      const result = await suggestBounty({
        prisma: mockPrisma as any,
        projectId: 'non-existent',
        userId: 'user-1',
        title: 'Suggested Bounty',
        description: 'Description',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    test('returns FOUNDER_CANNOT_SUGGEST when founder tries to suggest', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        founderId: 'founder-1',
        rewardPool: { id: 'pool-1' },
      })

      const result = await suggestBounty({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1', // Founder should use createBounty
        title: 'Suggested Bounty',
        description: 'Description',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FOUNDER_CANNOT_SUGGEST')
        expect(result.message).toContain('create bounties directly')
      }
    })

    test('returns NO_REWARD_POOL when project has no pool', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        founderId: 'founder-1',
        rewardPool: null,
      })

      const result = await suggestBounty({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'contributor-1',
        title: 'Suggested Bounty',
        description: 'Description',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NO_REWARD_POOL')
      }
    })
  })

  describe('success cases', () => {
    test('creates SUGGESTED bounty as contributor', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        founderId: 'founder-1',
        rewardPool: { id: 'pool-1' },
      })
      mockPrisma.project.update.mockResolvedValue({ nextBountyNumber: 2 })
      mockPrisma.bounty.create.mockResolvedValue({
        id: 'bounty-1',
        number: 1,
        status: BountyStatus.SUGGESTED,
        title: 'Suggested Bounty',
        description: 'Description',
      })

      const result = await suggestBounty({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'contributor-1',
        title: 'Suggested Bounty',
        description: 'Description',
        evidenceDescription: 'Provide screenshots',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.bounty.status).toBe(BountyStatus.SUGGESTED)
        expect(result.bounty.title).toBe('Suggested Bounty')
      }

      // Check bounty was created with correct data
      expect(mockPrisma.bounty.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'project-1',
          title: 'Suggested Bounty',
          description: 'Description',
          points: null,
          status: BountyStatus.SUGGESTED,
          suggestedById: 'contributor-1',
          evidenceDescription: 'Provide screenshots',
        }),
      })
    })

    test('associates pending attachments when id is provided', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        founderId: 'founder-1',
        rewardPool: { id: 'pool-1' },
      })
      mockPrisma.project.update.mockResolvedValue({ nextBountyNumber: 2 })
      mockPrisma.bounty.create.mockResolvedValue({
        id: 'pre-generated-id',
        number: 1,
        status: BountyStatus.SUGGESTED,
        title: 'Suggested Bounty',
        description: 'Description',
      })
      mockPrisma.attachment.updateMany.mockResolvedValue({ count: 2 })

      const result = await suggestBounty({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'contributor-1',
        id: 'pre-generated-id',
        title: 'Suggested Bounty',
        description: 'Description',
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.attachment.updateMany).toHaveBeenCalled()
    })
  })
})

// ================================
// approveSuggestion Tests
// ================================

describe('approveSuggestion', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns NOT_FOUND when bounty does not exist', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue(null)

      const result = await approveSuggestion({
        prisma: mockPrisma as any,
        bountyId: 'non-existent',
        userId: 'founder-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    test('returns FORBIDDEN when user is not founder', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.SUGGESTED,
        suggestedById: 'contributor-1',
        project: { founderId: 'founder-1' },
      })

      const result = await approveSuggestion({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'not-founder',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })

    test('returns NOT_SUGGESTED when bounty is not in SUGGESTED status', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.OPEN,
        project: { founderId: 'founder-1' },
      })

      const result = await approveSuggestion({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_SUGGESTED')
      }
    })
  })

  describe('success cases', () => {
    test('approves suggestion to BACKLOG when no points provided', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        number: 1,
        status: BountyStatus.SUGGESTED,
        suggestedById: 'contributor-1',
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        number: 1,
        status: BountyStatus.BACKLOG,
        title: 'Suggested Bounty',
        points: null,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      const result = await approveSuggestion({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.bounty.status).toBe(BountyStatus.BACKLOG)
        expect(result.bounty.points).toBe(null)
      }
    })

    test('approves suggestion to OPEN when points provided', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        number: 1,
        status: BountyStatus.SUGGESTED,
        suggestedById: 'contributor-1',
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        number: 1,
        status: BountyStatus.OPEN,
        title: 'Suggested Bounty',
        points: 100,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      const result = await approveSuggestion({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
        points: 100,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.bounty.status).toBe(BountyStatus.OPEN)
        expect(result.bounty.points).toBe(100)
      }
    })

    test('adds labels when labelIds provided', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        number: 1,
        status: BountyStatus.SUGGESTED,
        suggestedById: 'contributor-1',
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        number: 1,
        status: BountyStatus.OPEN,
        title: 'Suggested Bounty',
        points: 50,
      })
      mockPrisma.bountyLabel.createMany.mockResolvedValue({ count: 2 })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      await approveSuggestion({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
        points: 50,
        labelIds: ['label-1', 'label-2'],
      })

      expect(mockPrisma.bountyLabel.createMany).toHaveBeenCalledWith({
        data: [
          { bountyId: 'bounty-1', labelId: 'label-1' },
          { bountyId: 'bounty-1', labelId: 'label-2' },
        ],
      })
    })

    test('allows founder to update title and description during approval', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        number: 1,
        status: BountyStatus.SUGGESTED,
        suggestedById: 'contributor-1',
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        number: 1,
        status: BountyStatus.OPEN,
        title: 'Updated Title',
        points: 100,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      await approveSuggestion({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
        points: 100,
        title: 'Updated Title',
        description: 'Updated Description',
      })

      expect(mockPrisma.bounty.update).toHaveBeenCalledWith({
        where: { id: 'bounty-1' },
        data: expect.objectContaining({
          title: 'Updated Title',
          description: 'Updated Description',
        }),
      })
    })
  })
})

// ================================
// rejectSuggestion Tests
// ================================

describe('rejectSuggestion', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns NOT_FOUND when bounty does not exist', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue(null)

      const result = await rejectSuggestion({
        prisma: mockPrisma as any,
        bountyId: 'non-existent',
        userId: 'founder-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    test('returns FORBIDDEN when user is not founder', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.SUGGESTED,
        suggestedById: 'contributor-1',
        project: { founderId: 'founder-1' },
      })

      const result = await rejectSuggestion({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'not-founder',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })

    test('returns NOT_SUGGESTED when bounty is not in SUGGESTED status', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.OPEN,
        project: { founderId: 'founder-1' },
      })

      const result = await rejectSuggestion({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_SUGGESTED')
      }
    })
  })

  describe('success cases', () => {
    test('rejects suggestion and closes the bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.SUGGESTED,
        suggestedById: 'contributor-1',
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.CLOSED,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      const result = await rejectSuggestion({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.bounty.status).toBe(BountyStatus.CLOSED)
      }
      expect(mockPrisma.bounty.update).toHaveBeenCalledWith({
        where: { id: 'bounty-1' },
        data: { status: BountyStatus.CLOSED },
      })
    })

    test('creates event with rejection reason in content field', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.SUGGESTED,
        suggestedById: 'contributor-1',
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.CLOSED,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      await rejectSuggestion({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
        reason: 'Out of scope for this project',
      })

      expect(mockPrisma.bountyEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bountyId: 'bounty-1',
          userId: 'founder-1',
          fromStatus: BountyStatus.SUGGESTED,
          toStatus: BountyStatus.CLOSED,
          content: 'Out of scope for this project',
        }),
      })
    })

    test('uses default message when no reason provided', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.SUGGESTED,
        suggestedById: 'contributor-1',
        project: { founderId: 'founder-1' },
      })
      mockPrisma.bounty.update.mockResolvedValue({
        id: 'bounty-1',
        status: BountyStatus.CLOSED,
      })
      mockPrisma.bountyEvent.create.mockResolvedValue({})

      await rejectSuggestion({
        prisma: mockPrisma as any,
        bountyId: 'bounty-1',
        userId: 'founder-1',
      })

      expect(mockPrisma.bountyEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: 'Suggestion rejected',
        }),
      })
    })
  })
})
