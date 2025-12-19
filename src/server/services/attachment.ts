import { AttachmentReferenceType, ClaimStatus } from '@/lib/db/types'
import { deleteObject } from '@/lib/uploads/r2'
import type { PrismaClient } from '@prisma/client'

// Helper to check if a reference type is a pending type
export function isPendingType(referenceType: AttachmentReferenceType): boolean {
  return (
    referenceType === AttachmentReferenceType.PENDING_BOUNTY ||
    referenceType === AttachmentReferenceType.PENDING_SUBMISSION
  )
}

type ListAttachmentsParams = {
  prisma: PrismaClient
  referenceType: AttachmentReferenceType
  referenceId: string
  userId?: string // Required for pending types to filter by uploader
}

export async function listAttachments({
  prisma,
  referenceType,
  referenceId,
  userId,
}: ListAttachmentsParams) {
  // For pending types, only return attachments uploaded by the current user
  const where = isPendingType(referenceType)
    ? {
        referenceType,
        referenceId,
        ...(userId && { userId }),
      }
    : {
        referenceType,
        referenceId,
      }

  return prisma.attachment.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  })
}

type CreateAttachmentParams = {
  prisma: PrismaClient
  userId: string
  referenceType: AttachmentReferenceType
  referenceId: string
  fileName: string
  fileUrl: string
  fileKey: string
  fileSize: number
  contentType: string
  // Required for PENDING_SUBMISSION - validates user has an active claim
  bountyId?: string
  // Required for PENDING_BOUNTY - validates project exists
  projectId?: string
}

type CreateAttachmentResult =
  | {
      success: true
      attachment: Awaited<ReturnType<PrismaClient['attachment']['create']>>
    }
  | { success: false; code: string; message: string }

export async function createAttachment({
  prisma,
  userId,
  referenceType,
  referenceId,
  fileName,
  fileUrl,
  fileKey,
  fileSize,
  contentType,
  bountyId,
  projectId,
}: CreateAttachmentParams): Promise<CreateAttachmentResult> {
  // Validate permissions based on reference type
  if (referenceType === AttachmentReferenceType.PENDING_SUBMISSION) {
    // For pending submissions, validate user has an active claim on the bounty
    if (!bountyId) {
      return {
        success: false,
        code: 'BAD_REQUEST',
        message: 'bountyId is required for pending submission attachments',
      }
    }
    const claim = await prisma.bountyClaim.findFirst({
      where: {
        bountyId,
        userId,
        status: ClaimStatus.ACTIVE,
      },
    })
    if (!claim) {
      return {
        success: false,
        code: 'FORBIDDEN',
        message:
          'You must have an active claim on this bounty to upload attachments',
      }
    }
  } else if (referenceType === AttachmentReferenceType.PENDING_BOUNTY) {
    // For pending bounties, validate project exists
    // Any authenticated user can add attachments (founders creating, contributors suggesting)
    if (!projectId) {
      return {
        success: false,
        code: 'BAD_REQUEST',
        message: 'projectId is required for pending bounty attachments',
      }
    }
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    })
    if (!project) {
      return {
        success: false,
        code: 'NOT_FOUND',
        message: 'Project not found',
      }
    }
    // Allow any authenticated user - the bounty creation/suggestion will validate permissions
  } else if (!isPendingType(referenceType)) {
    // Verify user has permission to add attachments to existing entities
    if (referenceType === AttachmentReferenceType.BOUNTY) {
      const bounty = await prisma.bounty.findUnique({
        where: { id: referenceId },
        include: { project: { select: { founderId: true } } },
      })
      if (!bounty) {
        return {
          success: false,
          code: 'NOT_FOUND',
          message: 'Bounty not found',
        }
      }
      // Only founder can add attachments to bounties
      if (bounty.project.founderId !== userId) {
        return {
          success: false,
          code: 'FORBIDDEN',
          message: 'Only the founder can add attachments',
        }
      }
    } else if (referenceType === AttachmentReferenceType.SUBMISSION) {
      const submission = await prisma.submission.findUnique({
        where: { id: referenceId },
        include: {
          bounty: { include: { project: { select: { founderId: true } } } },
        },
      })
      if (!submission) {
        return {
          success: false,
          code: 'NOT_FOUND',
          message: 'Submission not found',
        }
      }
      // Submitter or founder can add attachments
      const isSubmitter = submission.userId === userId
      const isFounder = submission.bounty.project.founderId === userId
      if (!isSubmitter && !isFounder) {
        return { success: false, code: 'FORBIDDEN', message: 'Access denied' }
      }
    }
  }

  const attachment = await prisma.attachment.create({
    data: {
      referenceType,
      referenceId,
      userId,
      fileName,
      fileUrl,
      fileKey,
      fileSize,
      contentType,
    },
  })

  return { success: true, attachment }
}

type DeleteAttachmentParams = {
  prisma: PrismaClient
  userId: string
  attachmentId: string
}

type DeleteAttachmentResult =
  | { success: true }
  | { success: false; code: string; message: string }

export async function deleteAttachment({
  prisma,
  userId,
  attachmentId,
}: DeleteAttachmentParams): Promise<DeleteAttachmentResult> {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
  })

  if (!attachment) {
    return {
      success: false,
      code: 'NOT_FOUND',
      message: 'Attachment not found',
    }
  }

  // For pending types, only the uploader can delete
  if (isPendingType(attachment.referenceType as AttachmentReferenceType)) {
    if (attachment.userId !== userId) {
      return { success: false, code: 'FORBIDDEN', message: 'Access denied' }
    }
  } else {
    // Verify user has permission to delete from existing entities
    if (attachment.referenceType === AttachmentReferenceType.BOUNTY) {
      const bounty = await prisma.bounty.findUnique({
        where: { id: attachment.referenceId },
        include: { project: { select: { founderId: true } } },
      })
      if (!bounty || bounty.project.founderId !== userId) {
        return {
          success: false,
          code: 'FORBIDDEN',
          message: 'Only the founder can delete attachments',
        }
      }
    } else if (
      attachment.referenceType === AttachmentReferenceType.SUBMISSION
    ) {
      const submission = await prisma.submission.findUnique({
        where: { id: attachment.referenceId },
        include: {
          bounty: { include: { project: { select: { founderId: true } } } },
        },
      })
      if (!submission) {
        return { success: false, code: 'FORBIDDEN', message: 'Access denied' }
      }
      // Only attachment uploader or founder can delete
      const isUploader = attachment.userId === userId
      const isFounder = submission.bounty.project.founderId === userId
      if (!isUploader && !isFounder) {
        return { success: false, code: 'FORBIDDEN', message: 'Access denied' }
      }
    }
  }

  // Delete from R2
  await deleteObject(attachment.fileKey)

  // Delete from database
  await prisma.attachment.delete({
    where: { id: attachmentId },
  })

  return { success: true }
}
