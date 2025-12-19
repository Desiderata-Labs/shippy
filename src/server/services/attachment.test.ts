/* eslint-disable @typescript-eslint/no-explicit-any */
import { AttachmentReferenceType, ClaimStatus } from '@/lib/db/types'
import {
  createAttachment,
  deleteAttachment,
  isPendingType,
  listAttachments,
} from './attachment'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock the R2 module
vi.mock('@/lib/uploads/r2', () => ({
  deleteObject: vi.fn().mockResolvedValue(undefined),
}))

// ================================
// Mock Factory
// ================================

type MockPrisma = {
  attachment: {
    findUnique: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
  bountyClaim: {
    findFirst: ReturnType<typeof vi.fn>
  }
  bounty: {
    findUnique: ReturnType<typeof vi.fn>
  }
  submission: {
    findUnique: ReturnType<typeof vi.fn>
  }
  project: {
    findUnique: ReturnType<typeof vi.fn>
  }
}

function createMockPrisma(): MockPrisma {
  return {
    attachment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    bountyClaim: {
      findFirst: vi.fn(),
    },
    bounty: {
      findUnique: vi.fn(),
    },
    submission: {
      findUnique: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  }
}

// ================================
// isPendingType Tests
// ================================

describe('isPendingType', () => {
  test('returns true for PENDING_BOUNTY', () => {
    expect(isPendingType(AttachmentReferenceType.PENDING_BOUNTY)).toBe(true)
  })

  test('returns true for PENDING_SUBMISSION', () => {
    expect(isPendingType(AttachmentReferenceType.PENDING_SUBMISSION)).toBe(true)
  })

  test('returns false for BOUNTY', () => {
    expect(isPendingType(AttachmentReferenceType.BOUNTY)).toBe(false)
  })

  test('returns false for SUBMISSION', () => {
    expect(isPendingType(AttachmentReferenceType.SUBMISSION)).toBe(false)
  })
})

// ================================
// listAttachments Tests
// ================================

describe('listAttachments', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  test('lists attachments for non-pending reference type without userId filter', async () => {
    const mockAttachments = [
      { id: 'att-1', fileName: 'file1.png' },
      { id: 'att-2', fileName: 'file2.png' },
    ]
    mockPrisma.attachment.findMany.mockResolvedValue(mockAttachments)

    const result = await listAttachments({
      prisma: mockPrisma as any,
      referenceType: AttachmentReferenceType.BOUNTY,
      referenceId: 'bounty-1',
    })

    expect(result).toEqual(mockAttachments)
    expect(mockPrisma.attachment.findMany).toHaveBeenCalledWith({
      where: {
        referenceType: AttachmentReferenceType.BOUNTY,
        referenceId: 'bounty-1',
      },
      orderBy: { createdAt: 'asc' },
    })
  })

  test('lists attachments for SUBMISSION reference type', async () => {
    const mockAttachments = [{ id: 'att-1', fileName: 'submission-file.png' }]
    mockPrisma.attachment.findMany.mockResolvedValue(mockAttachments)

    const result = await listAttachments({
      prisma: mockPrisma as any,
      referenceType: AttachmentReferenceType.SUBMISSION,
      referenceId: 'submission-1',
    })

    expect(result).toEqual(mockAttachments)
    expect(mockPrisma.attachment.findMany).toHaveBeenCalledWith({
      where: {
        referenceType: AttachmentReferenceType.SUBMISSION,
        referenceId: 'submission-1',
      },
      orderBy: { createdAt: 'asc' },
    })
  })

  test('lists attachments for PENDING_BOUNTY with userId filter', async () => {
    const mockAttachments = [{ id: 'att-1', fileName: 'pending.png' }]
    mockPrisma.attachment.findMany.mockResolvedValue(mockAttachments)

    const result = await listAttachments({
      prisma: mockPrisma as any,
      referenceType: AttachmentReferenceType.PENDING_BOUNTY,
      referenceId: 'pending-bounty-id',
      userId: 'user-1',
    })

    expect(result).toEqual(mockAttachments)
    expect(mockPrisma.attachment.findMany).toHaveBeenCalledWith({
      where: {
        referenceType: AttachmentReferenceType.PENDING_BOUNTY,
        referenceId: 'pending-bounty-id',
        userId: 'user-1',
      },
      orderBy: { createdAt: 'asc' },
    })
  })

  test('lists attachments for PENDING_SUBMISSION with userId filter', async () => {
    const mockAttachments: never[] = []
    mockPrisma.attachment.findMany.mockResolvedValue(mockAttachments)

    const result = await listAttachments({
      prisma: mockPrisma as any,
      referenceType: AttachmentReferenceType.PENDING_SUBMISSION,
      referenceId: 'pending-submission-id',
      userId: 'user-2',
    })

    expect(result).toEqual(mockAttachments)
    expect(mockPrisma.attachment.findMany).toHaveBeenCalledWith({
      where: {
        referenceType: AttachmentReferenceType.PENDING_SUBMISSION,
        referenceId: 'pending-submission-id',
        userId: 'user-2',
      },
      orderBy: { createdAt: 'asc' },
    })
  })
})

// ================================
// createAttachment Tests
// ================================

describe('createAttachment', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  const baseAttachmentData = {
    fileName: 'test-file.png',
    fileUrl: 'https://cdn.example.com/test-file.png',
    fileKey: 'uploads/test-file.png',
    fileSize: 1024,
    contentType: 'image/png',
  }

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('PENDING_SUBMISSION reference type', () => {
    test('returns BAD_REQUEST when bountyId is not provided', async () => {
      const result = await createAttachment({
        prisma: mockPrisma as any,
        userId: 'user-1',
        referenceType: AttachmentReferenceType.PENDING_SUBMISSION,
        referenceId: 'pending-sub-id',
        ...baseAttachmentData,
        // bountyId not provided
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('BAD_REQUEST')
        expect(result.message).toContain('bountyId is required')
      }
    })

    test('returns FORBIDDEN when user has no active claim on bounty', async () => {
      mockPrisma.bountyClaim.findFirst.mockResolvedValue(null)

      const result = await createAttachment({
        prisma: mockPrisma as any,
        userId: 'user-1',
        referenceType: AttachmentReferenceType.PENDING_SUBMISSION,
        referenceId: 'pending-sub-id',
        bountyId: 'bounty-1',
        ...baseAttachmentData,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
        expect(result.message).toContain('active claim')
      }
      expect(mockPrisma.bountyClaim.findFirst).toHaveBeenCalledWith({
        where: {
          bountyId: 'bounty-1',
          userId: 'user-1',
          status: ClaimStatus.ACTIVE,
        },
      })
    })

    test('creates attachment when user has active claim', async () => {
      mockPrisma.bountyClaim.findFirst.mockResolvedValue({
        id: 'claim-1',
        bountyId: 'bounty-1',
        userId: 'user-1',
        status: ClaimStatus.ACTIVE,
      })
      const createdAttachment = {
        id: 'att-1',
        referenceType: AttachmentReferenceType.PENDING_SUBMISSION,
        referenceId: 'pending-sub-id',
        userId: 'user-1',
        ...baseAttachmentData,
      }
      mockPrisma.attachment.create.mockResolvedValue(createdAttachment)

      const result = await createAttachment({
        prisma: mockPrisma as any,
        userId: 'user-1',
        referenceType: AttachmentReferenceType.PENDING_SUBMISSION,
        referenceId: 'pending-sub-id',
        bountyId: 'bounty-1',
        ...baseAttachmentData,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.attachment).toEqual(createdAttachment)
      }
      expect(mockPrisma.attachment.create).toHaveBeenCalledWith({
        data: {
          referenceType: AttachmentReferenceType.PENDING_SUBMISSION,
          referenceId: 'pending-sub-id',
          userId: 'user-1',
          ...baseAttachmentData,
        },
      })
    })
  })

  describe('PENDING_BOUNTY reference type', () => {
    test('returns BAD_REQUEST when projectId is not provided', async () => {
      const result = await createAttachment({
        prisma: mockPrisma as any,
        userId: 'user-1',
        referenceType: AttachmentReferenceType.PENDING_BOUNTY,
        referenceId: 'pending-bounty-id',
        ...baseAttachmentData,
        // projectId not provided
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('BAD_REQUEST')
        expect(result.message).toContain('projectId is required')
      }
    })

    test('returns NOT_FOUND when project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null)

      const result = await createAttachment({
        prisma: mockPrisma as any,
        userId: 'user-1',
        referenceType: AttachmentReferenceType.PENDING_BOUNTY,
        referenceId: 'pending-bounty-id',
        projectId: 'non-existent',
        ...baseAttachmentData,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
        expect(result.message).toContain('Project not found')
      }
    })

    test('creates attachment when user is the founder', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
      })
      const createdAttachment = {
        id: 'att-1',
        referenceType: AttachmentReferenceType.PENDING_BOUNTY,
        referenceId: 'pending-bounty-id',
        userId: 'founder-1',
        ...baseAttachmentData,
      }
      mockPrisma.attachment.create.mockResolvedValue(createdAttachment)

      const result = await createAttachment({
        prisma: mockPrisma as any,
        userId: 'founder-1',
        referenceType: AttachmentReferenceType.PENDING_BOUNTY,
        referenceId: 'pending-bounty-id',
        projectId: 'project-1',
        ...baseAttachmentData,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.attachment).toEqual(createdAttachment)
      }
    })

    test('creates attachment when user is a contributor (for bounty suggestions)', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
      })
      const createdAttachment = {
        id: 'att-1',
        referenceType: AttachmentReferenceType.PENDING_BOUNTY,
        referenceId: 'pending-bounty-id',
        userId: 'contributor-1',
        ...baseAttachmentData,
      }
      mockPrisma.attachment.create.mockResolvedValue(createdAttachment)

      const result = await createAttachment({
        prisma: mockPrisma as any,
        userId: 'contributor-1',
        referenceType: AttachmentReferenceType.PENDING_BOUNTY,
        referenceId: 'pending-bounty-id',
        projectId: 'project-1',
        ...baseAttachmentData,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.attachment).toEqual(createdAttachment)
      }
    })
  })

  describe('BOUNTY reference type', () => {
    test('returns NOT_FOUND when bounty does not exist', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue(null)

      const result = await createAttachment({
        prisma: mockPrisma as any,
        userId: 'user-1',
        referenceType: AttachmentReferenceType.BOUNTY,
        referenceId: 'bounty-1',
        ...baseAttachmentData,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
        expect(result.message).toContain('Bounty not found')
      }
    })

    test('returns FORBIDDEN when user is not the founder', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        project: { founderId: 'founder-1' },
      })

      const result = await createAttachment({
        prisma: mockPrisma as any,
        userId: 'not-founder',
        referenceType: AttachmentReferenceType.BOUNTY,
        referenceId: 'bounty-1',
        ...baseAttachmentData,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
        expect(result.message).toContain('Only the founder')
      }
    })

    test('creates attachment when user is the founder', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        project: { founderId: 'founder-1' },
      })
      const createdAttachment = {
        id: 'att-1',
        referenceType: AttachmentReferenceType.BOUNTY,
        referenceId: 'bounty-1',
        userId: 'founder-1',
        ...baseAttachmentData,
      }
      mockPrisma.attachment.create.mockResolvedValue(createdAttachment)

      const result = await createAttachment({
        prisma: mockPrisma as any,
        userId: 'founder-1',
        referenceType: AttachmentReferenceType.BOUNTY,
        referenceId: 'bounty-1',
        ...baseAttachmentData,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.attachment).toEqual(createdAttachment)
      }
    })
  })

  describe('SUBMISSION reference type', () => {
    test('returns NOT_FOUND when submission does not exist', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue(null)

      const result = await createAttachment({
        prisma: mockPrisma as any,
        userId: 'user-1',
        referenceType: AttachmentReferenceType.SUBMISSION,
        referenceId: 'submission-1',
        ...baseAttachmentData,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
        expect(result.message).toContain('Submission not found')
      }
    })

    test('returns FORBIDDEN when user is neither submitter nor founder', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'submission-1',
        userId: 'submitter-1',
        bounty: { project: { founderId: 'founder-1' } },
      })

      const result = await createAttachment({
        prisma: mockPrisma as any,
        userId: 'random-user',
        referenceType: AttachmentReferenceType.SUBMISSION,
        referenceId: 'submission-1',
        ...baseAttachmentData,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
        expect(result.message).toContain('Access denied')
      }
    })

    test('creates attachment when user is the submitter', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'submission-1',
        userId: 'submitter-1',
        bounty: { project: { founderId: 'founder-1' } },
      })
      const createdAttachment = {
        id: 'att-1',
        referenceType: AttachmentReferenceType.SUBMISSION,
        referenceId: 'submission-1',
        userId: 'submitter-1',
        ...baseAttachmentData,
      }
      mockPrisma.attachment.create.mockResolvedValue(createdAttachment)

      const result = await createAttachment({
        prisma: mockPrisma as any,
        userId: 'submitter-1',
        referenceType: AttachmentReferenceType.SUBMISSION,
        referenceId: 'submission-1',
        ...baseAttachmentData,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.attachment).toEqual(createdAttachment)
      }
    })

    test('creates attachment when user is the founder', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'submission-1',
        userId: 'submitter-1',
        bounty: { project: { founderId: 'founder-1' } },
      })
      const createdAttachment = {
        id: 'att-1',
        referenceType: AttachmentReferenceType.SUBMISSION,
        referenceId: 'submission-1',
        userId: 'founder-1',
        ...baseAttachmentData,
      }
      mockPrisma.attachment.create.mockResolvedValue(createdAttachment)

      const result = await createAttachment({
        prisma: mockPrisma as any,
        userId: 'founder-1',
        referenceType: AttachmentReferenceType.SUBMISSION,
        referenceId: 'submission-1',
        ...baseAttachmentData,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.attachment).toEqual(createdAttachment)
      }
    })
  })
})

// ================================
// deleteAttachment Tests
// ================================

describe('deleteAttachment', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>
  let mockDeleteObject: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
    // Get the mocked function
    const r2Module = await import('@/lib/uploads/r2')
    mockDeleteObject = r2Module.deleteObject as ReturnType<typeof vi.fn>
  })

  test('returns NOT_FOUND when attachment does not exist', async () => {
    mockPrisma.attachment.findUnique.mockResolvedValue(null)

    const result = await deleteAttachment({
      prisma: mockPrisma as any,
      userId: 'user-1',
      attachmentId: 'non-existent',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('NOT_FOUND')
      expect(result.message).toContain('Attachment not found')
    }
  })

  describe('pending types', () => {
    test('allows uploader to delete PENDING_BOUNTY attachment', async () => {
      const attachment = {
        id: 'att-1',
        referenceType: AttachmentReferenceType.PENDING_BOUNTY,
        referenceId: 'pending-bounty-id',
        userId: 'uploader-1',
        fileKey: 'uploads/file.png',
      }
      mockPrisma.attachment.findUnique.mockResolvedValue(attachment)
      mockPrisma.attachment.delete.mockResolvedValue(attachment)

      const result = await deleteAttachment({
        prisma: mockPrisma as any,
        userId: 'uploader-1',
        attachmentId: 'att-1',
      })

      expect(result.success).toBe(true)
      expect(mockDeleteObject).toHaveBeenCalledWith('uploads/file.png')
      expect(mockPrisma.attachment.delete).toHaveBeenCalledWith({
        where: { id: 'att-1' },
      })
    })

    test('allows uploader to delete PENDING_SUBMISSION attachment', async () => {
      const attachment = {
        id: 'att-1',
        referenceType: AttachmentReferenceType.PENDING_SUBMISSION,
        referenceId: 'pending-sub-id',
        userId: 'uploader-1',
        fileKey: 'uploads/file.png',
      }
      mockPrisma.attachment.findUnique.mockResolvedValue(attachment)
      mockPrisma.attachment.delete.mockResolvedValue(attachment)

      const result = await deleteAttachment({
        prisma: mockPrisma as any,
        userId: 'uploader-1',
        attachmentId: 'att-1',
      })

      expect(result.success).toBe(true)
      expect(mockDeleteObject).toHaveBeenCalledWith('uploads/file.png')
    })

    test('returns FORBIDDEN when non-uploader tries to delete pending attachment', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        referenceType: AttachmentReferenceType.PENDING_BOUNTY,
        referenceId: 'pending-bounty-id',
        userId: 'uploader-1',
        fileKey: 'uploads/file.png',
      })

      const result = await deleteAttachment({
        prisma: mockPrisma as any,
        userId: 'not-uploader',
        attachmentId: 'att-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
        expect(result.message).toContain('Access denied')
      }
      expect(mockDeleteObject).not.toHaveBeenCalled()
      expect(mockPrisma.attachment.delete).not.toHaveBeenCalled()
    })
  })

  describe('BOUNTY reference type', () => {
    test('allows founder to delete bounty attachment', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        referenceType: AttachmentReferenceType.BOUNTY,
        referenceId: 'bounty-1',
        userId: 'founder-1',
        fileKey: 'uploads/bounty-file.png',
      })
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        project: { founderId: 'founder-1' },
      })
      mockPrisma.attachment.delete.mockResolvedValue({})

      const result = await deleteAttachment({
        prisma: mockPrisma as any,
        userId: 'founder-1',
        attachmentId: 'att-1',
      })

      expect(result.success).toBe(true)
      expect(mockDeleteObject).toHaveBeenCalledWith('uploads/bounty-file.png')
      expect(mockPrisma.attachment.delete).toHaveBeenCalled()
    })

    test('returns FORBIDDEN when non-founder tries to delete bounty attachment', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        referenceType: AttachmentReferenceType.BOUNTY,
        referenceId: 'bounty-1',
        userId: 'founder-1',
        fileKey: 'uploads/bounty-file.png',
      })
      mockPrisma.bounty.findUnique.mockResolvedValue({
        id: 'bounty-1',
        project: { founderId: 'founder-1' },
      })

      const result = await deleteAttachment({
        prisma: mockPrisma as any,
        userId: 'not-founder',
        attachmentId: 'att-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
        expect(result.message).toContain('Only the founder')
      }
    })

    test('returns FORBIDDEN when bounty not found', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        referenceType: AttachmentReferenceType.BOUNTY,
        referenceId: 'bounty-1',
        userId: 'user-1',
        fileKey: 'uploads/bounty-file.png',
      })
      mockPrisma.bounty.findUnique.mockResolvedValue(null)

      const result = await deleteAttachment({
        prisma: mockPrisma as any,
        userId: 'user-1',
        attachmentId: 'att-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })
  })

  describe('SUBMISSION reference type', () => {
    test('allows uploader to delete their submission attachment', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        referenceType: AttachmentReferenceType.SUBMISSION,
        referenceId: 'submission-1',
        userId: 'submitter-1',
        fileKey: 'uploads/submission-file.png',
      })
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'submission-1',
        userId: 'submitter-1',
        bounty: { project: { founderId: 'founder-1' } },
      })
      mockPrisma.attachment.delete.mockResolvedValue({})

      const result = await deleteAttachment({
        prisma: mockPrisma as any,
        userId: 'submitter-1',
        attachmentId: 'att-1',
      })

      expect(result.success).toBe(true)
      expect(mockDeleteObject).toHaveBeenCalledWith(
        'uploads/submission-file.png',
      )
    })

    test('allows founder to delete submission attachment', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        referenceType: AttachmentReferenceType.SUBMISSION,
        referenceId: 'submission-1',
        userId: 'submitter-1',
        fileKey: 'uploads/submission-file.png',
      })
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'submission-1',
        userId: 'submitter-1',
        bounty: { project: { founderId: 'founder-1' } },
      })
      mockPrisma.attachment.delete.mockResolvedValue({})

      const result = await deleteAttachment({
        prisma: mockPrisma as any,
        userId: 'founder-1',
        attachmentId: 'att-1',
      })

      expect(result.success).toBe(true)
    })

    test('returns FORBIDDEN when random user tries to delete submission attachment', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        referenceType: AttachmentReferenceType.SUBMISSION,
        referenceId: 'submission-1',
        userId: 'submitter-1',
        fileKey: 'uploads/submission-file.png',
      })
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: 'submission-1',
        userId: 'submitter-1',
        bounty: { project: { founderId: 'founder-1' } },
      })

      const result = await deleteAttachment({
        prisma: mockPrisma as any,
        userId: 'random-user',
        attachmentId: 'att-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
        expect(result.message).toContain('Access denied')
      }
    })

    test('returns FORBIDDEN when submission not found', async () => {
      mockPrisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        referenceType: AttachmentReferenceType.SUBMISSION,
        referenceId: 'submission-1',
        userId: 'user-1',
        fileKey: 'uploads/submission-file.png',
      })
      mockPrisma.submission.findUnique.mockResolvedValue(null)

      const result = await deleteAttachment({
        prisma: mockPrisma as any,
        userId: 'user-1',
        attachmentId: 'att-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })
  })
})
