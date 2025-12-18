/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createLabel,
  deleteLabel,
  getLabel,
  listLabels,
  updateLabel,
} from './label'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// ================================
// Mock Factory
// ================================

function createMockPrisma() {
  return {
    project: {
      findUnique: vi.fn(),
    },
    label: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
}

// ================================
// listLabels Tests
// ================================

describe('listLabels', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns NOT_FOUND when project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null)

      const result = await listLabels({
        prisma: mockPrisma as any,
        projectId: 'non-existent',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('success cases', () => {
    test('returns empty array when project has no labels', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'project-1' })
      mockPrisma.label.findMany.mockResolvedValue([])

      const result = await listLabels({
        prisma: mockPrisma as any,
        projectId: 'project-1',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.labels).toEqual([])
      }
    })

    test('returns labels ordered by createdAt', async () => {
      const labels = [
        { id: 'label-1', name: 'Bug', color: '#FF0000', createdAt: new Date() },
        {
          id: 'label-2',
          name: 'Feature',
          color: '#00FF00',
          createdAt: new Date(),
        },
      ]
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'project-1' })
      mockPrisma.label.findMany.mockResolvedValue(labels)

      const result = await listLabels({
        prisma: mockPrisma as any,
        projectId: 'project-1',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.labels).toHaveLength(2)
        expect(result.labels[0].name).toBe('Bug')
        expect(result.labels[1].name).toBe('Feature')
      }
      expect(mockPrisma.label.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          color: true,
          createdAt: true,
        },
      })
    })
  })
})

// ================================
// getLabel Tests
// ================================

describe('getLabel', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns NOT_FOUND when label does not exist', async () => {
      mockPrisma.label.findUnique.mockResolvedValue(null)

      const result = await getLabel({
        prisma: mockPrisma as any,
        labelId: 'non-existent',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('success cases', () => {
    test('returns label by ID', async () => {
      const label = {
        id: 'label-1',
        name: 'Bug',
        color: '#FF0000',
        projectId: 'project-1',
        createdAt: new Date(),
      }
      mockPrisma.label.findUnique.mockResolvedValue(label)

      const result = await getLabel({
        prisma: mockPrisma as any,
        labelId: 'label-1',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.label.id).toBe('label-1')
        expect(result.label.name).toBe('Bug')
        expect(result.label.color).toBe('#FF0000')
        expect(result.label.projectId).toBe('project-1')
      }
    })
  })
})

// ================================
// createLabel Tests
// ================================

describe('createLabel', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns INVALID_COLOR for invalid hex format', async () => {
      const result = await createLabel({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'user-1',
        name: 'Bug',
        color: 'red', // Invalid - not hex
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('INVALID_COLOR')
      }
    })

    test('returns INVALID_COLOR for incomplete hex', async () => {
      const result = await createLabel({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'user-1',
        name: 'Bug',
        color: '#FFF', // Invalid - only 3 chars
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('INVALID_COLOR')
      }
    })

    test('returns NOT_FOUND when project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null)

      const result = await createLabel({
        prisma: mockPrisma as any,
        projectId: 'non-existent',
        userId: 'user-1',
        name: 'Bug',
        color: '#FF0000',
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

      const result = await createLabel({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'not-founder',
        name: 'Bug',
        color: '#FF0000',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })

    test('returns CONFLICT when label name already exists', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
      })
      mockPrisma.label.findUnique.mockResolvedValue({
        id: 'existing',
        name: 'Bug',
      })

      const result = await createLabel({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        name: 'Bug',
        color: '#FF0000',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('CONFLICT')
      }
    })
  })

  describe('success cases', () => {
    test('creates label with valid hex color', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
      })
      mockPrisma.label.findUnique.mockResolvedValue(null) // No conflict
      mockPrisma.label.create.mockResolvedValue({
        id: 'new-label',
        name: 'Bug',
        color: '#FF0000',
        createdAt: new Date(),
      })

      const result = await createLabel({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        name: 'Bug',
        color: '#FF0000',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.label.name).toBe('Bug')
        expect(result.label.color).toBe('#FF0000')
      }
      expect(mockPrisma.label.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          name: 'Bug',
          color: '#FF0000',
        },
        select: {
          id: true,
          name: true,
          color: true,
          createdAt: true,
        },
      })
    })

    test('accepts lowercase hex colors', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        founderId: 'founder-1',
      })
      mockPrisma.label.findUnique.mockResolvedValue(null)
      mockPrisma.label.create.mockResolvedValue({
        id: 'new-label',
        name: 'Feature',
        color: '#00ff00',
        createdAt: new Date(),
      })

      const result = await createLabel({
        prisma: mockPrisma as any,
        projectId: 'project-1',
        userId: 'founder-1',
        name: 'Feature',
        color: '#00ff00',
      })

      expect(result.success).toBe(true)
    })
  })
})

// ================================
// updateLabel Tests
// ================================

describe('updateLabel', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns NO_CHANGES when no updates provided', async () => {
      const result = await updateLabel({
        prisma: mockPrisma as any,
        labelId: 'label-1',
        userId: 'user-1',
        data: {},
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NO_CHANGES')
      }
    })

    test('returns INVALID_COLOR for invalid hex format', async () => {
      const result = await updateLabel({
        prisma: mockPrisma as any,
        labelId: 'label-1',
        userId: 'user-1',
        data: { color: 'blue' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('INVALID_COLOR')
      }
    })

    test('returns NOT_FOUND when label does not exist', async () => {
      mockPrisma.label.findUnique.mockResolvedValue(null)

      const result = await updateLabel({
        prisma: mockPrisma as any,
        labelId: 'non-existent',
        userId: 'user-1',
        data: { name: 'New Name' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    test('returns FORBIDDEN when user is not founder', async () => {
      mockPrisma.label.findUnique.mockResolvedValue({
        id: 'label-1',
        name: 'Old Name',
        color: '#FF0000',
        projectId: 'project-1',
        project: { founderId: 'founder-1' },
      })

      const result = await updateLabel({
        prisma: mockPrisma as any,
        labelId: 'label-1',
        userId: 'not-founder',
        data: { name: 'New Name' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })

    test('returns CONFLICT when new name already exists', async () => {
      mockPrisma.label.findUnique
        .mockResolvedValueOnce({
          id: 'label-1',
          name: 'Old Name',
          color: '#FF0000',
          projectId: 'project-1',
          project: { founderId: 'founder-1' },
        })
        .mockResolvedValueOnce({
          id: 'other-label',
          name: 'New Name',
        }) // Conflict

      const result = await updateLabel({
        prisma: mockPrisma as any,
        labelId: 'label-1',
        userId: 'founder-1',
        data: { name: 'New Name' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('CONFLICT')
      }
    })

    test('returns NO_CHANGES when values are same as current', async () => {
      mockPrisma.label.findUnique.mockResolvedValue({
        id: 'label-1',
        name: 'Bug',
        color: '#FF0000',
        projectId: 'project-1',
        project: { founderId: 'founder-1' },
      })

      const result = await updateLabel({
        prisma: mockPrisma as any,
        labelId: 'label-1',
        userId: 'founder-1',
        data: { name: 'Bug', color: '#FF0000' }, // Same values
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NO_CHANGES')
      }
    })
  })

  describe('success cases', () => {
    test('updates label name', async () => {
      mockPrisma.label.findUnique
        .mockResolvedValueOnce({
          id: 'label-1',
          name: 'Old Name',
          color: '#FF0000',
          projectId: 'project-1',
          project: { founderId: 'founder-1' },
        })
        .mockResolvedValueOnce(null) // No conflict

      mockPrisma.label.update.mockResolvedValue({
        id: 'label-1',
        name: 'New Name',
        color: '#FF0000',
        createdAt: new Date(),
      })

      const result = await updateLabel({
        prisma: mockPrisma as any,
        labelId: 'label-1',
        userId: 'founder-1',
        data: { name: 'New Name' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.label.name).toBe('New Name')
      }
    })

    test('updates label color', async () => {
      mockPrisma.label.findUnique.mockResolvedValue({
        id: 'label-1',
        name: 'Bug',
        color: '#FF0000',
        projectId: 'project-1',
        project: { founderId: 'founder-1' },
      })

      mockPrisma.label.update.mockResolvedValue({
        id: 'label-1',
        name: 'Bug',
        color: '#00FF00',
        createdAt: new Date(),
      })

      const result = await updateLabel({
        prisma: mockPrisma as any,
        labelId: 'label-1',
        userId: 'founder-1',
        data: { color: '#00FF00' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.label.color).toBe('#00FF00')
      }
    })

    test('updates both name and color', async () => {
      mockPrisma.label.findUnique
        .mockResolvedValueOnce({
          id: 'label-1',
          name: 'Old Name',
          color: '#FF0000',
          projectId: 'project-1',
          project: { founderId: 'founder-1' },
        })
        .mockResolvedValueOnce(null) // No conflict

      mockPrisma.label.update.mockResolvedValue({
        id: 'label-1',
        name: 'New Name',
        color: '#00FF00',
        createdAt: new Date(),
      })

      const result = await updateLabel({
        prisma: mockPrisma as any,
        labelId: 'label-1',
        userId: 'founder-1',
        data: { name: 'New Name', color: '#00FF00' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.label.name).toBe('New Name')
        expect(result.label.color).toBe('#00FF00')
      }
    })
  })
})

// ================================
// deleteLabel Tests
// ================================

describe('deleteLabel', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    vi.clearAllMocks()
  })

  describe('error cases', () => {
    test('returns NOT_FOUND when label does not exist', async () => {
      mockPrisma.label.findUnique.mockResolvedValue(null)

      const result = await deleteLabel({
        prisma: mockPrisma as any,
        labelId: 'non-existent',
        userId: 'user-1',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    test('returns FORBIDDEN when user is not founder', async () => {
      mockPrisma.label.findUnique.mockResolvedValue({
        id: 'label-1',
        project: { founderId: 'founder-1' },
      })

      const result = await deleteLabel({
        prisma: mockPrisma as any,
        labelId: 'label-1',
        userId: 'not-founder',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe('FORBIDDEN')
      }
    })
  })

  describe('success cases', () => {
    test('deletes label when authorized', async () => {
      mockPrisma.label.findUnique.mockResolvedValue({
        id: 'label-1',
        project: { founderId: 'founder-1' },
      })
      mockPrisma.label.delete.mockResolvedValue({})

      const result = await deleteLabel({
        prisma: mockPrisma as any,
        labelId: 'label-1',
        userId: 'founder-1',
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.label.delete).toHaveBeenCalledWith({
        where: { id: 'label-1' },
      })
    })
  })
})

// ================================
// Hex Color Validation Tests
// ================================

describe('Hex Color Validation', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
  })

  const validColors = [
    '#000000',
    '#FFFFFF',
    '#ffffff',
    '#FF5500',
    '#ff5500',
    '#123456',
    '#ABCDEF',
    '#abcdef',
  ]

  const invalidColors = [
    'red',
    'blue',
    '#FFF', // Too short
    '#FFFFFFF', // Too long
    '000000', // Missing #
    '#GGGGGG', // Invalid hex chars
    '#12345', // 5 chars
    '#1234567', // 7 chars
    '', // Empty
    '#', // Just hash
  ]

  test.each(validColors)('accepts valid hex color: %s', async (color) => {
    mockPrisma.project.findUnique.mockResolvedValue({ founderId: 'founder-1' })
    mockPrisma.label.findUnique.mockResolvedValue(null)
    mockPrisma.label.create.mockResolvedValue({
      id: 'new-label',
      name: 'Test',
      color,
      createdAt: new Date(),
    })

    const result = await createLabel({
      prisma: mockPrisma as any,
      projectId: 'project-1',
      userId: 'founder-1',
      name: 'Test',
      color,
    })

    expect(result.success).toBe(true)
  })

  test.each(invalidColors)('rejects invalid hex color: %s', async (color) => {
    const result = await createLabel({
      prisma: mockPrisma as any,
      projectId: 'project-1',
      userId: 'founder-1',
      name: 'Test',
      color,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('INVALID_COLOR')
    }
  })
})
