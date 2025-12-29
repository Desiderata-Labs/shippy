/* eslint-disable @typescript-eslint/no-explicit-any */
import { CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION } from '@/lib/db/types'
import {
  acceptAgreement,
  checkAgreement,
  getAgreementDetails,
  getTemplate,
  listAcceptances,
} from './contributor-agreement'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock server-only
vi.mock('server-only', () => ({}))

// ================================
// Mock Factory
// ================================

function createMockPrisma() {
  return {
    project: {
      findUnique: vi.fn(),
    },
    contributorAgreement: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  }
}

function createMockProject(overrides = {}) {
  return {
    id: 'project-1',
    name: 'Test Project',
    slug: 'test-project',
    founderId: 'founder-1',
    contributorTermsEnabled: true,
    contributorTermsVersion: 1,
    contributorTermsCustom: null,
    projectOwnerLegalName: 'Test Company LLC',
    projectOwnerContactEmail: 'legal@test.com',
    projectOwnerAuthorizedRepresentativeName: null,
    projectOwnerAuthorizedRepresentativeTitle: null,
    contributorTermsGoverningLaw: null,
    rewardPool: {
      id: 'pool-1',
      poolPercentage: 10,
      commitmentEndsAt: new Date('2026-01-01'),
    },
    founder: {
      name: 'Test Founder',
    },
    ...overrides,
  }
}

// ================================
// checkAgreement Tests
// ================================

describe('checkAgreement', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  test('returns requiresAcceptance=true when project not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null)

    const result = await checkAgreement(
      mockPrisma as any,
      'project-1',
      'user-1',
    )

    expect(result.hasValidAgreement).toBe(false)
    expect(result.requiresAcceptance).toBe(true)
  })

  test('returns requiresAcceptance=false when terms are disabled', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      contributorTermsEnabled: false,
      contributorTermsVersion: 1,
    })

    const result = await checkAgreement(
      mockPrisma as any,
      'project-1',
      'user-1',
    )

    expect(result.hasValidAgreement).toBe(true)
    expect(result.requiresAcceptance).toBe(false)
  })

  test('returns requiresAcceptance=true when no agreement exists', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      contributorTermsEnabled: true,
      contributorTermsVersion: 1,
    })
    mockPrisma.contributorAgreement.findFirst.mockResolvedValue(null)

    const result = await checkAgreement(
      mockPrisma as any,
      'project-1',
      'user-1',
    )

    expect(result.hasValidAgreement).toBe(false)
    expect(result.requiresAcceptance).toBe(true)
  })

  test('returns hasValidAgreement=true when versions match', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      contributorTermsEnabled: true,
      contributorTermsVersion: 1,
    })
    mockPrisma.contributorAgreement.findFirst.mockResolvedValue({
      id: 'agreement-1',
      standardTemplateVersion: CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION,
      projectTermsVersion: 1,
      acceptedAt: new Date(),
    })

    const result = await checkAgreement(
      mockPrisma as any,
      'project-1',
      'user-1',
    )

    expect(result.hasValidAgreement).toBe(true)
    expect(result.requiresAcceptance).toBe(false)
  })

  test('returns requiresAcceptance=true when project terms version changed', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      contributorTermsEnabled: true,
      contributorTermsVersion: 2, // Updated
    })
    mockPrisma.contributorAgreement.findFirst.mockResolvedValue({
      id: 'agreement-1',
      standardTemplateVersion: CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION,
      projectTermsVersion: 1, // Old version
      acceptedAt: new Date(),
    })

    const result = await checkAgreement(
      mockPrisma as any,
      'project-1',
      'user-1',
    )

    expect(result.hasValidAgreement).toBe(false)
    expect(result.requiresAcceptance).toBe(true)
  })
})

// ================================
// getTemplate Tests
// ================================

describe('getTemplate', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  test('returns PROJECT_NOT_FOUND when project does not exist', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null)

    const result = await getTemplate({
      prisma: mockPrisma as any,
      projectId: 'nonexistent',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('PROJECT_NOT_FOUND')
    }
  })

  test('returns rendered template with project data', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(createMockProject())

    const result = await getTemplate({
      prisma: mockPrisma as any,
      projectId: 'project-1',
      contributorName: 'Test User',
      contributorEmail: 'test@example.com',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.markdown).toContain('Test Project')
      expect(result.termsEnabled).toBe(true)
      expect(result.standardTemplateVersion).toBe(
        CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION,
      )
    }
  })
})

// ================================
// acceptAgreement Tests
// ================================

describe('acceptAgreement', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  test('returns PROJECT_NOT_FOUND when project does not exist', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null)

    const result = await acceptAgreement({
      prisma: mockPrisma as any,
      projectId: 'nonexistent',
      userId: 'user-1',
      userEmail: 'test@example.com',
      userName: 'Test User',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('PROJECT_NOT_FOUND')
    }
  })

  test('returns ALREADY_ACCEPTED when valid agreement exists', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(createMockProject())
    mockPrisma.contributorAgreement.findFirst.mockResolvedValue({
      id: 'agreement-1',
      standardTemplateVersion: CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION,
      projectTermsVersion: 1,
      acceptedAt: new Date(),
    })

    const result = await acceptAgreement({
      prisma: mockPrisma as any,
      projectId: 'project-1',
      userId: 'user-1',
      userEmail: 'test@example.com',
      userName: 'Test User',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('ALREADY_ACCEPTED')
    }
  })

  test('creates agreement record when terms not yet accepted', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(createMockProject())
    mockPrisma.contributorAgreement.findFirst.mockResolvedValue(null)
    mockPrisma.contributorAgreement.create.mockResolvedValue({
      id: 'new-agreement-1',
    })

    const result = await acceptAgreement({
      prisma: mockPrisma as any,
      projectId: 'project-1',
      userId: 'user-1',
      userEmail: 'test@example.com',
      userName: 'Test User',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.agreementId).toBe('new-agreement-1')
    }
    expect(mockPrisma.contributorAgreement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'project-1',
          userId: 'user-1',
          standardTemplateVersion: CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION,
          projectTermsVersion: 1,
        }),
      }),
    )
  })
})

// ================================
// listAcceptances Tests
// ================================

describe('listAcceptances', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  test('returns PROJECT_NOT_FOUND when project does not exist', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null)

    const result = await listAcceptances({
      prisma: mockPrisma as any,
      projectId: 'nonexistent',
      userId: 'user-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('PROJECT_NOT_FOUND')
    }
  })

  test('returns FORBIDDEN when user is not founder', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      founderId: 'other-user',
    })

    const result = await listAcceptances({
      prisma: mockPrisma as any,
      projectId: 'project-1',
      userId: 'user-1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('FORBIDDEN')
    }
  })

  test('returns agreements list for founder', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      founderId: 'founder-1',
    })
    mockPrisma.contributorAgreement.findMany.mockResolvedValue([
      {
        id: 'agreement-1',
        standardTemplateVersion: 1,
        projectTermsVersion: 1,
        acceptedAt: new Date(),
        user: { id: 'user-1', name: 'User 1', username: 'user1', image: null },
      },
    ])

    const result = await listAcceptances({
      prisma: mockPrisma as any,
      projectId: 'project-1',
      userId: 'founder-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.agreements).toHaveLength(1)
    }
  })
})

// ================================
// getAgreementDetails Tests
// ================================

describe('getAgreementDetails', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  test('returns null when no agreement exists', async () => {
    mockPrisma.contributorAgreement.findFirst.mockResolvedValue(null)

    const result = await getAgreementDetails(
      mockPrisma as any,
      'project-1',
      'user-1',
    )

    expect(result).toBeNull()
  })

  test('returns agreement details when exists', async () => {
    const mockAgreement = {
      id: 'agreement-1',
      standardTemplateVersion: 1,
      projectTermsVersion: 1,
      acceptedAt: new Date(),
      termsSnapshot: {},
    }
    mockPrisma.contributorAgreement.findFirst.mockResolvedValue(mockAgreement)

    const result = await getAgreementDetails(
      mockPrisma as any,
      'project-1',
      'user-1',
    )

    expect(result).toEqual(mockAgreement)
  })
})
