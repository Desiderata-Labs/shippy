import { isValidHexColor } from '@/lib/db/types'
import type { Prisma, PrismaClient } from '@prisma/client'

// Type for either PrismaClient or a transaction client
type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

// ================================
// List Labels Service
// ================================

export interface ListLabelsParams {
  prisma: PrismaClientOrTx
  projectId: string
}

export interface ListLabelsResult {
  success: true
  labels: Array<{
    id: string
    name: string
    color: string
    createdAt: Date
  }>
}

export type ListLabelsError = {
  success: false
  code: 'NOT_FOUND'
  message: string
}

/**
 * List all labels for a project
 */
export async function listLabels({
  prisma,
  projectId,
}: ListLabelsParams): Promise<ListLabelsResult | ListLabelsError> {
  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  })

  if (!project) {
    return { success: false, code: 'NOT_FOUND', message: 'Project not found' }
  }

  const labels = await prisma.label.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      color: true,
      createdAt: true,
    },
  })

  return { success: true, labels }
}

// ================================
// Get Label Service
// ================================

export interface GetLabelParams {
  prisma: PrismaClientOrTx
  labelId: string
}

export interface GetLabelResult {
  success: true
  label: {
    id: string
    name: string
    color: string
    projectId: string
    createdAt: Date
  }
}

export type GetLabelError = {
  success: false
  code: 'NOT_FOUND'
  message: string
}

/**
 * Get a single label by ID
 */
export async function getLabel({
  prisma,
  labelId,
}: GetLabelParams): Promise<GetLabelResult | GetLabelError> {
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: {
      id: true,
      name: true,
      color: true,
      projectId: true,
      createdAt: true,
    },
  })

  if (!label) {
    return { success: false, code: 'NOT_FOUND', message: 'Label not found' }
  }

  return { success: true, label }
}

// ================================
// Create Label Service
// ================================

export interface CreateLabelParams {
  prisma: PrismaClientOrTx
  projectId: string
  userId: string // For authorization
  name: string
  color: string
}

export interface CreateLabelResult {
  success: true
  label: {
    id: string
    name: string
    color: string
    createdAt: Date
  }
}

export type CreateLabelError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }
  | { success: false; code: 'CONFLICT'; message: string }
  | { success: false; code: 'INVALID_COLOR'; message: string }

/**
 * Create a new label for a project
 *
 * This handles:
 * - Verifying project exists
 * - Validating ownership (founder check)
 * - Validating hex color format
 * - Checking for duplicate names
 * - Creating the label
 */
export async function createLabel({
  prisma,
  projectId,
  userId,
  name,
  color,
}: CreateLabelParams): Promise<CreateLabelResult | CreateLabelError> {
  // Validate hex color
  if (!isValidHexColor(color)) {
    return {
      success: false,
      code: 'INVALID_COLOR',
      message: 'Invalid hex color format (expected #RRGGBB)',
    }
  }

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { founderId: true },
  })

  if (!project) {
    return { success: false, code: 'NOT_FOUND', message: 'Project not found' }
  }

  if (project.founderId !== userId) {
    return {
      success: false,
      code: 'FORBIDDEN',
      message: 'You do not own this project',
    }
  }

  // Check for duplicate name
  const existing = await prisma.label.findUnique({
    where: {
      projectId_name: {
        projectId,
        name,
      },
    },
  })

  if (existing) {
    return {
      success: false,
      code: 'CONFLICT',
      message: 'A label with this name already exists',
    }
  }

  const label = await prisma.label.create({
    data: {
      projectId,
      name,
      color,
    },
    select: {
      id: true,
      name: true,
      color: true,
      createdAt: true,
    },
  })

  return { success: true, label }
}

// ================================
// Update Label Service
// ================================

export interface UpdateLabelParams {
  prisma: PrismaClientOrTx
  labelId: string
  userId: string // For authorization
  data: {
    name?: string
    color?: string
  }
}

export interface UpdateLabelResult {
  success: true
  label: {
    id: string
    name: string
    color: string
    createdAt: Date
  }
}

export type UpdateLabelError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }
  | { success: false; code: 'CONFLICT'; message: string }
  | { success: false; code: 'INVALID_COLOR'; message: string }
  | { success: false; code: 'NO_CHANGES'; message: string }

/**
 * Update a label
 *
 * This handles:
 * - Verifying label exists
 * - Validating ownership (founder check)
 * - Validating hex color format if provided
 * - Checking for duplicate names if changing name
 * - Updating the label
 */
export async function updateLabel({
  prisma,
  labelId,
  userId,
  data,
}: UpdateLabelParams): Promise<UpdateLabelResult | UpdateLabelError> {
  // Check if any updates provided
  if (data.name === undefined && data.color === undefined) {
    return {
      success: false,
      code: 'NO_CHANGES',
      message: 'No updates provided',
    }
  }

  // Validate hex color if provided
  if (data.color !== undefined && !isValidHexColor(data.color)) {
    return {
      success: false,
      code: 'INVALID_COLOR',
      message: 'Invalid hex color format (expected #RRGGBB)',
    }
  }

  // Verify label exists and get ownership info
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    include: { project: { select: { founderId: true } } },
  })

  if (!label) {
    return { success: false, code: 'NOT_FOUND', message: 'Label not found' }
  }

  if (label.project.founderId !== userId) {
    return {
      success: false,
      code: 'FORBIDDEN',
      message: 'You do not own this project',
    }
  }

  // If changing name, check for duplicates
  if (data.name !== undefined && data.name !== label.name) {
    const existing = await prisma.label.findUnique({
      where: {
        projectId_name: {
          projectId: label.projectId,
          name: data.name,
        },
      },
    })

    if (existing) {
      return {
        success: false,
        code: 'CONFLICT',
        message: 'A label with this name already exists',
      }
    }
  }

  // Build update data (only include changed fields)
  const updateData: Prisma.LabelUpdateInput = {}
  if (data.name !== undefined && data.name !== label.name) {
    updateData.name = data.name
  }
  if (data.color !== undefined && data.color !== label.color) {
    updateData.color = data.color
  }

  // If nothing actually changed, return early
  if (Object.keys(updateData).length === 0) {
    return {
      success: false,
      code: 'NO_CHANGES',
      message: 'No changes detected',
    }
  }

  const updated = await prisma.label.update({
    where: { id: labelId },
    data: updateData,
    select: {
      id: true,
      name: true,
      color: true,
      createdAt: true,
    },
  })

  return { success: true, label: updated }
}

// ================================
// Delete Label Service
// ================================

export interface DeleteLabelParams {
  prisma: PrismaClientOrTx
  labelId: string
  userId: string // For authorization
}

export interface DeleteLabelResult {
  success: true
}

export type DeleteLabelError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }

/**
 * Delete a label from a project
 *
 * This handles:
 * - Verifying label exists
 * - Validating ownership (founder check)
 * - Deleting the label (cascade removes bounty associations)
 */
export async function deleteLabel({
  prisma,
  labelId,
  userId,
}: DeleteLabelParams): Promise<DeleteLabelResult | DeleteLabelError> {
  // Verify label exists and get ownership info
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    include: { project: { select: { founderId: true } } },
  })

  if (!label) {
    return { success: false, code: 'NOT_FOUND', message: 'Label not found' }
  }

  if (label.project.founderId !== userId) {
    return {
      success: false,
      code: 'FORBIDDEN',
      message: 'You do not own this project',
    }
  }

  await prisma.label.delete({
    where: { id: labelId },
  })

  return { success: true }
}
