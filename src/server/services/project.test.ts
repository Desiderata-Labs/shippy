/* eslint-disable @typescript-eslint/no-explicit-any */
import { BountyStatus, PayoutFrequency, ProfitBasis } from '@/lib/db/types'
import { isProjectKeyAvailable } from '@/lib/project-key/server'
import { validateProjectKey } from '@/lib/project-key/shared'
// Import mocked functions for control
import {
  isProjectSlugAvailable,
  validateProjectSlug,
} from '@/lib/project-slug/server'
import { createProject, updateProject, updateProjectLogo } from './project'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock the slug validation modules
vi.mock('@/lib/project-slug/server', () => ({
  isProjectSlugAvailable: vi.fn(),
  validateProjectSlug: vi.fn().mockReturnValue({ isValid: true }),
}))

vi.mock('@/lib/project-key/server', () => ({
  isProjectKeyAvailable: vi.fn(),
}))

vi.mock('@/lib/project-key/shared', () => ({
  validateProjectKey: vi.fn().mockReturnValue({ isValid: true }),
}))

const mockValidateProjectSlug = validateProjectSlug as ReturnType<typeof vi.fn>
const mockIsProjectSlugAvailable = isProjectSlugAvailable as ReturnType<
  typeof vi.fn
>
const mockValidateProjectKey = validateProjectKey as ReturnType<typeof vi.fn>
const mockIsProjectKeyAvailable = isProjectKeyAvailable as ReturnType<
  typeof vi.fn
>

// ================================
// Mock Factory
// ================================

function createMockPrisma() {
  return {
    project: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bounty: {
      count: vi.fn(),
    },
  }
}

// ================================
// createProject Tests
// ================================

describe('createProject', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
    // Reset mocks to default passing state
    mockValidateProjectSlug.mockReturnValue({ isValid: true })
    mockIsProjectSlugAvailable.mockResolvedValue(true)
    mockValidateProjectKey.mockReturnValue({ isValid: true })
    mockIsProjectKeyAvailable.mockResolvedValue(true)
  })

  describe('error cases', () => {
    test('returns INVALID_SLUG when slug format is invalid', async () => {
      mockValidateProjectSlug.mockReturnValue({
        isValid: false,
        error: 'Slug cannot contain spaces',
      })

      const result = await createProject({
        prisma: mockPrisma as any,
        userId: 'user-1',
        name: 'My Project',
        slug: 'invalid slug',
        projectKey: 'MYP',
        poolPercentage: 10,
        payoutFrequency: PayoutFrequency.MONTHLY,
        commitmentMonths: 12,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('INVALID_SLUG')
        expect(result.message).toContain('spaces')
      }
    })

    test('returns SLUG_TAKEN when slug is already used', async () => {
      mockIsProjectSlugAvailable.mockResolvedValue(false)

      const result = await createProject({
        prisma: mockPrisma as any,
        userId: 'user-1',
        name: 'My Project',
        slug: 'taken-slug',
        projectKey: 'MYP',
        poolPercentage: 10,
        payoutFrequency: PayoutFrequency.MONTHLY,
        commitmentMonths: 12,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('SLUG_TAKEN')
      }
    })

    test('returns INVALID_PROJECT_KEY when key format is invalid', async () => {
      mockValidateProjectKey.mockReturnValue({
        isValid: false,
        error: 'Project key must be uppercase',
      })

      const result = await createProject({
        prisma: mockPrisma as any,
        userId: 'user-1',
        name: 'My Project',
        slug: 'my-project',
        projectKey: 'invalid',
        poolPercentage: 10,
        payoutFrequency: PayoutFrequency.MONTHLY,
        commitmentMonths: 12,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('INVALID_PROJECT_KEY')
      }
    })

    test('returns PROJECT_KEY_TAKEN when key already used by founder', async () => {
      mockIsProjectKeyAvailable.mockResolvedValue(false)

      const result = await createProject({
        prisma: mockPrisma as any,
        userId: 'user-1',
        name: 'My Project',
        slug: 'my-project',
        projectKey: 'MYP',
        poolPercentage: 10,
        payoutFrequency: PayoutFrequency.MONTHLY,
        commitmentMonths: 12,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('PROJECT_KEY_TAKEN')
      }
    })
  })

  describe('success cases', () => {
    test('creates project with reward pool', async () => {
      mockPrisma.project.create.mockResolvedValue({
        id: 'project-1',
        name: 'My Project',
        slug: 'my-project',
        projectKey: 'MYP',
      })

      const result = await createProject({
        prisma: mockPrisma as any,
        userId: 'user-1',
        name: 'My Project',
        slug: 'my-project',
        projectKey: 'MYP',
        poolPercentage: 10,
        payoutFrequency: PayoutFrequency.MONTHLY,
        commitmentMonths: 12,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.project.name).toBe('My Project')
        expect(result.project.slug).toBe('my-project')
        expect(result.project.projectKey).toBe('MYP')
      }
      expect(mockPrisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'My Project',
            slug: 'my-project',
            projectKey: 'MYP',
            founderId: 'user-1',
            rewardPool: expect.objectContaining({
              create: expect.objectContaining({
                poolPercentage: 10,
                payoutFrequency: PayoutFrequency.MONTHLY,
                commitmentMonths: 12,
              }),
            }),
          }),
        }),
      )
    })

    test('creates project with optional fields', async () => {
      mockPrisma.project.create.mockResolvedValue({
        id: 'project-1',
        name: 'My Project',
        slug: 'my-project',
        projectKey: 'MYP',
      })

      await createProject({
        prisma: mockPrisma as any,
        userId: 'user-1',
        name: 'My Project',
        slug: 'my-project',
        projectKey: 'MYP',
        tagline: 'The best project',
        description: 'A longer description',
        logoUrl: 'https://example.com/logo.png',
        websiteUrl: 'https://example.com',
        discordUrl: 'https://discord.gg/abc',
        poolPercentage: 10,
        payoutFrequency: PayoutFrequency.QUARTERLY,
        profitBasis: ProfitBasis.GROSS_REVENUE,
        commitmentMonths: 24,
        payoutVisibility: 'PUBLIC',
      })

      expect(mockPrisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tagline: 'The best project',
            description: 'A longer description',
            logoUrl: 'https://example.com/logo.png',
            websiteUrl: 'https://example.com',
            discordUrl: 'https://discord.gg/abc',
            payoutVisibility: 'PUBLIC',
            rewardPool: expect.objectContaining({
              create: expect.objectContaining({
                profitBasis: ProfitBasis.GROSS_REVENUE,
                commitmentMonths: 24,
              }),
            }),
          }),
        }),
      )
    })

    test('defaults profitBasis to NET_PROFIT when not provided', async () => {
      mockPrisma.project.create.mockResolvedValue({
        id: 'project-1',
        name: 'My Project',
        slug: 'my-project',
        projectKey: 'MYP',
      })

      await createProject({
        prisma: mockPrisma as any,
        userId: 'user-1',
        name: 'My Project',
        slug: 'my-project',
        projectKey: 'MYP',
        poolPercentage: 10,
        payoutFrequency: PayoutFrequency.MONTHLY,
        commitmentMonths: 12,
      })

      expect(mockPrisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rewardPool: expect.objectContaining({
              create: expect.objectContaining({
                profitBasis: ProfitBasis.NET_PROFIT,
              }),
            }),
          }),
        }),
      )
    })

    test('calculates commitment end date correctly', async () => {
      const beforeCall = new Date()
      mockPrisma.project.create.mockResolvedValue({
        id: 'project-1',
        name: 'My Project',
        slug: 'my-project',
        projectKey: 'MYP',
      })

      await createProject({
        prisma: mockPrisma as any,
        userId: 'user-1',
        name: 'My Project',
        slug: 'my-project',
        projectKey: 'MYP',
        poolPercentage: 10,
        payoutFrequency: PayoutFrequency.MONTHLY,
        commitmentMonths: 12,
      })

      const createCall = mockPrisma.project.create.mock.calls[0][0]
      const commitmentEndsAt =
        createCall.data.rewardPool.create.commitmentEndsAt

      // Should be approximately 12 months from now
      const expectedMin = new Date(beforeCall)
      expectedMin.setMonth(expectedMin.getMonth() + 12)

      expect(commitmentEndsAt.getTime()).toBeGreaterThanOrEqual(
        expectedMin.getTime() - 1000, // 1 second tolerance
      )
    })

    test('creates project with contributor agreement settings', async () => {
      mockPrisma.project.create.mockResolvedValue({
        id: 'project-1',
        name: 'My Project',
        slug: 'my-project',
        projectKey: 'MYP',
      })

      await createProject({
        prisma: mockPrisma as any,
        userId: 'user-1',
        name: 'My Project',
        slug: 'my-project',
        projectKey: 'MYP',
        poolPercentage: 10,
        payoutFrequency: PayoutFrequency.MONTHLY,
        commitmentMonths: 12,
        // Contributor agreement settings
        contributorTermsEnabled: true,
        contributorTermsCustom: 'Custom terms here',
        projectOwnerLegalName: 'Test Company LLC',
        projectOwnerContactEmail: 'legal@test.com',
        contributorTermsGoverningLaw: 'California, USA',
        projectOwnerAuthorizedRepresentativeName: 'John Doe',
        projectOwnerAuthorizedRepresentativeTitle: 'CEO',
      })

      expect(mockPrisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contributorTermsEnabled: true,
            contributorTermsCustom: 'Custom terms here',
            projectOwnerLegalName: 'Test Company LLC',
            projectOwnerContactEmail: 'legal@test.com',
            contributorTermsGoverningLaw: 'California, USA',
            projectOwnerAuthorizedRepresentativeName: 'John Doe',
            projectOwnerAuthorizedRepresentativeTitle: 'CEO',
          }),
        }),
      )
    })

    test('defaults contributorTermsEnabled to false when not provided', async () => {
      mockPrisma.project.create.mockResolvedValue({
        id: 'project-1',
        name: 'My Project',
        slug: 'my-project',
        projectKey: 'MYP',
      })

      await createProject({
        prisma: mockPrisma as any,
        userId: 'user-1',
        name: 'My Project',
        slug: 'my-project',
        projectKey: 'MYP',
        poolPercentage: 10,
        payoutFrequency: PayoutFrequency.MONTHLY,
        commitmentMonths: 12,
      })

      expect(mockPrisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contributorTermsEnabled: false,
          }),
        }),
      )
    })
  })
})

// ================================
// updateProject Tests
// ================================

describe('updateProject', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
    mockValidateProjectSlug.mockReturnValue({ isValid: true })
    mockIsProjectSlugAvailable.mockResolvedValue(true)
    mockValidateProjectKey.mockReturnValue({ isValid: true })
    mockIsProjectKeyAvailable.mockResolvedValue(true)
  })

  describe('error cases', () => {
    test('returns NOT_FOUND when project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null)

      const result = await updateProject({
        prisma: mockPrisma as any,
        projectId: 'non-existent',
        userId: 'user-1',
        data: { name: 'New Name' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    test('returns FORBIDDEN when user is not founder', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'old-slug',
        projectKey: 'OLD',
      })

      const result = await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'not-founder',
        data: { name: 'New Name' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })

    test('returns INVALID_SLUG when new slug format is invalid', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'old-slug',
        projectKey: 'OLD',
      })
      mockValidateProjectSlug.mockReturnValue({
        isValid: false,
        error: 'Invalid slug format',
      })

      const result = await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: { slug: 'invalid slug' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('INVALID_SLUG')
      }
    })

    test('returns SLUG_TAKEN when new slug is already used', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'old-slug',
        projectKey: 'OLD',
      })
      mockIsProjectSlugAvailable.mockResolvedValue(false)

      const result = await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: { slug: 'taken-slug' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('SLUG_TAKEN')
      }
    })

    test('returns INVALID_PROJECT_KEY when new key format is invalid', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'old-slug',
        projectKey: 'OLD',
      })
      mockValidateProjectKey.mockReturnValue({
        isValid: false,
        error: 'Invalid key',
      })

      const result = await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: { projectKey: 'invalid' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('INVALID_PROJECT_KEY')
      }
    })

    test('returns PROJECT_KEY_TAKEN when new key already used', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'old-slug',
        projectKey: 'OLD',
      })
      mockIsProjectKeyAvailable.mockResolvedValue(false)

      const result = await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: { projectKey: 'NEW' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('PROJECT_KEY_TAKEN')
      }
    })

    test('returns REWARD_POOL_LOCKED when bounties claimed', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'project-slug',
        projectKey: 'KEY',
      })
      mockPrisma.bounty.count.mockResolvedValue(1) // Has claimed bounties

      const result = await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: { poolPercentage: 20 },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('REWARD_POOL_LOCKED')
      }
    })

    test('returns REWARD_POOL_LOCKED when updating payoutFrequency with claimed bounties', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'project-slug',
        projectKey: 'KEY',
      })
      mockPrisma.bounty.count.mockResolvedValue(2)

      const result = await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: { payoutFrequency: PayoutFrequency.QUARTERLY },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('REWARD_POOL_LOCKED')
      }
    })

    test('returns NO_CHANGES when no updates provided', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'project-slug',
        projectKey: 'KEY',
      })

      const result = await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: {},
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NO_CHANGES')
      }
    })
  })

  describe('success cases', () => {
    test('updates basic project fields', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'project-slug',
        projectKey: 'KEY',
      })
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-1',
        name: 'New Name',
        slug: 'project-slug',
        projectKey: 'KEY',
      })

      const result = await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: {
          name: 'New Name',
          tagline: 'New tagline',
          description: 'New description',
        },
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: expect.objectContaining({
          name: 'New Name',
          tagline: 'New tagline',
          description: 'New description',
        }),
        select: expect.any(Object),
      })
    })

    test('updates slug when changed', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'old-slug',
        projectKey: 'KEY',
      })
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-1',
        name: 'Project',
        slug: 'new-slug',
        projectKey: 'KEY',
      })

      const result = await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: { slug: 'new-slug' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.project.slug).toBe('new-slug')
      }
    })

    test('skips slug validation when unchanged', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'same-slug',
        projectKey: 'KEY',
      })
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-1',
        name: 'New Name',
        slug: 'same-slug',
        projectKey: 'KEY',
      })

      await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: { slug: 'same-slug', name: 'New Name' },
      })

      // Should not check availability for same slug
      expect(mockIsProjectSlugAvailable).not.toHaveBeenCalled()
    })

    test('updates reward pool when no claimed bounties', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'project-slug',
        projectKey: 'KEY',
      })
      mockPrisma.bounty.count.mockResolvedValue(0) // No claimed bounties
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-1',
        name: 'Project',
        slug: 'project-slug',
        projectKey: 'KEY',
      })

      const result = await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: { poolPercentage: 20 },
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: expect.objectContaining({
          rewardPool: { update: { poolPercentage: 20 } },
        }),
        select: expect.any(Object),
      })
    })

    test('allows non-pool updates when bounties are claimed', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'project-slug',
        projectKey: 'KEY',
      })
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-1',
        name: 'New Name',
        slug: 'project-slug',
        projectKey: 'KEY',
      })

      // Note: We're NOT updating pool settings, so count shouldn't be called
      const result = await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: { name: 'New Name' },
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.bounty.count).not.toHaveBeenCalled()
    })

    test('updates URLs to null to clear them', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'project-slug',
        projectKey: 'KEY',
      })
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-1',
        name: 'Project',
        slug: 'project-slug',
        projectKey: 'KEY',
      })

      await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: {
          websiteUrl: null,
          discordUrl: null,
          logoUrl: null,
        },
      })

      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: expect.objectContaining({
          websiteUrl: null,
          discordUrl: null,
          logoUrl: null,
        }),
        select: expect.any(Object),
      })
    })
  })

  describe('bounty status checks for reward pool updates', () => {
    test('checks for CLAIMED and COMPLETED bounties', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'project-slug',
        projectKey: 'KEY',
      })
      mockPrisma.bounty.count.mockResolvedValue(0)
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-1',
        name: 'Project',
        slug: 'project-slug',
        projectKey: 'KEY',
      })

      await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: { poolPercentage: 15 },
      })

      expect(mockPrisma.bounty.count).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          status: {
            in: [BountyStatus.CLAIMED, BountyStatus.COMPLETED],
          },
        },
      })
    })
  })

  describe('contributor agreement settings', () => {
    test('updates contributor agreement fields', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'project-slug',
        projectKey: 'KEY',
      })
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-1',
        name: 'Project',
        slug: 'project-slug',
        projectKey: 'KEY',
      })

      await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: {
          contributorTermsEnabled: true,
          projectOwnerLegalName: 'Test Company LLC',
          projectOwnerContactEmail: 'legal@test.com',
        },
      })

      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: expect.objectContaining({
          contributorTermsEnabled: true,
          projectOwnerLegalName: 'Test Company LLC',
          projectOwnerContactEmail: 'legal@test.com',
        }),
        select: expect.any(Object),
      })
    })

    test('increments contributorTermsVersion when custom terms change', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'project-slug',
        projectKey: 'KEY',
      })
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-1',
        name: 'Project',
        slug: 'project-slug',
        projectKey: 'KEY',
      })

      await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: {
          contributorTermsCustom: 'Updated custom terms',
        },
      })

      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: expect.objectContaining({
          contributorTermsCustom: 'Updated custom terms',
          contributorTermsVersion: { increment: 1 },
        }),
        select: expect.any(Object),
      })
    })

    test('increments version even when setting custom terms to null', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'project-slug',
        projectKey: 'KEY',
      })
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-1',
        name: 'Project',
        slug: 'project-slug',
        projectKey: 'KEY',
      })

      await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: {
          contributorTermsCustom: null,
        },
      })

      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: expect.objectContaining({
          contributorTermsCustom: null,
          contributorTermsVersion: { increment: 1 },
        }),
        select: expect.any(Object),
      })
    })

    test('does NOT increment version when only non-custom fields change', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'project-slug',
        projectKey: 'KEY',
      })
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-1',
        name: 'Project',
        slug: 'project-slug',
        projectKey: 'KEY',
      })

      await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: {
          contributorTermsEnabled: true,
          projectOwnerLegalName: 'New Legal Name',
          contributorTermsGoverningLaw: 'Delaware, USA',
        },
      })

      const updateCall = mockPrisma.project.update.mock.calls[0][0]
      // Should NOT have version increment when custom terms not changed
      expect(updateCall.data.contributorTermsVersion).toBeUndefined()
    })

    test('clears contributor agreement fields when set to null', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'project-slug',
        projectKey: 'KEY',
      })
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-1',
        name: 'Project',
        slug: 'project-slug',
        projectKey: 'KEY',
      })

      await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: {
          projectOwnerLegalName: null,
          projectOwnerContactEmail: null,
          contributorTermsGoverningLaw: null,
          projectOwnerAuthorizedRepresentativeName: null,
          projectOwnerAuthorizedRepresentativeTitle: null,
        },
      })

      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: expect.objectContaining({
          projectOwnerLegalName: null,
          projectOwnerContactEmail: null,
          contributorTermsGoverningLaw: null,
          projectOwnerAuthorizedRepresentativeName: null,
          projectOwnerAuthorizedRepresentativeTitle: null,
        }),
        select: expect.any(Object),
      })
    })

    test('updates all contributor agreement fields at once', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
        slug: 'project-slug',
        projectKey: 'KEY',
      })
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-1',
        name: 'Project',
        slug: 'project-slug',
        projectKey: 'KEY',
      })

      await updateProject({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        data: {
          contributorTermsEnabled: true,
          contributorTermsCustom: 'Custom terms',
          projectOwnerLegalName: 'Test Company LLC',
          projectOwnerContactEmail: 'legal@test.com',
          contributorTermsGoverningLaw: 'California, USA',
          projectOwnerAuthorizedRepresentativeName: 'Jane Smith',
          projectOwnerAuthorizedRepresentativeTitle: 'CTO',
        },
      })

      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: expect.objectContaining({
          contributorTermsEnabled: true,
          contributorTermsCustom: 'Custom terms',
          contributorTermsVersion: { increment: 1 }, // Should increment because custom terms changed
          projectOwnerLegalName: 'Test Company LLC',
          projectOwnerContactEmail: 'legal@test.com',
          contributorTermsGoverningLaw: 'California, USA',
          projectOwnerAuthorizedRepresentativeName: 'Jane Smith',
          projectOwnerAuthorizedRepresentativeTitle: 'CTO',
        }),
        select: expect.any(Object),
      })
    })
  })
})

// ================================
// updateProjectLogo Tests
// ================================

describe('updateProjectLogo', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns NOT_FOUND when project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null)

      const result = await updateProjectLogo({
        prisma: mockPrisma as any,
        projectId: 'non-existent',
        userId: 'user-1',
        logoUrl: 'https://example.com/logo.png',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    test('returns FORBIDDEN when user is not founder', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
      })

      const result = await updateProjectLogo({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'not-founder',
        logoUrl: 'https://example.com/logo.png',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })
  })

  describe('success cases', () => {
    test('updates logo URL', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
      })
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-1',
        logoUrl: 'https://example.com/new-logo.png',
      })

      const result = await updateProjectLogo({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        logoUrl: 'https://example.com/new-logo.png',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.project.logoUrl).toBe('https://example.com/new-logo.png')
      }
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: { logoUrl: 'https://example.com/new-logo.png' },
        select: { id: true, logoUrl: true },
      })
    })

    test('removes logo by setting to null', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
      })
      mockPrisma.project.update.mockResolvedValue({
        id: 'project-1',
        logoUrl: null,
      })

      const result = await updateProjectLogo({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        logoUrl: null,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.project.logoUrl).toBeNull()
      }
    })
  })
})
