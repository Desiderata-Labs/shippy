import { AttachmentReferenceType } from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/zod'
import {
  createAttachment,
  deleteAttachment,
  isPendingType,
  listAttachments,
} from '@/server/services/attachment'
import { protectedProcedure, router, userError } from '@/server/trpc'
import { z } from 'zod/v4'

export const attachmentRouter = router({
  /**
   * Get attachments for a reference (bounty, submission, or pending)
   */
  getByReference: protectedProcedure
    .input(
      z.object({
        referenceType: z.nativeEnum(AttachmentReferenceType),
        referenceId: nanoId(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listAttachments({
        prisma: ctx.prisma,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        userId: isPendingType(input.referenceType) ? ctx.user.id : undefined,
      })
    }),

  /**
   * Create an attachment record after file is uploaded to R2
   */
  create: protectedProcedure
    .input(
      z.object({
        referenceType: z.nativeEnum(AttachmentReferenceType),
        referenceId: nanoId(),
        fileName: z.string().min(1),
        fileUrl: z.string().url(),
        fileKey: z.string().min(1),
        fileSize: z.number().int().min(0),
        contentType: z.string().min(1),
        // Required for PENDING_SUBMISSION - validates user has an active claim
        bountyId: nanoId().optional(),
        // Required for PENDING_BOUNTY - validates project exists
        projectId: nanoId().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await createAttachment({
        prisma: ctx.prisma,
        userId: ctx.user.id,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileKey: input.fileKey,
        fileSize: input.fileSize,
        contentType: input.contentType,
        bountyId: input.bountyId,
        projectId: input.projectId,
      })

      if (!result.success) {
        throw userError(
          result.code as 'NOT_FOUND' | 'FORBIDDEN',
          result.message,
        )
      }

      return result.attachment
    }),

  /**
   * Delete an attachment (removes from R2 and database)
   */
  delete: protectedProcedure
    .input(z.object({ id: nanoId() }))
    .mutation(async ({ ctx, input }) => {
      const result = await deleteAttachment({
        prisma: ctx.prisma,
        userId: ctx.user.id,
        attachmentId: input.id,
      })

      if (!result.success) {
        throw userError(
          result.code as 'NOT_FOUND' | 'FORBIDDEN',
          result.message,
        )
      }

      return { success: true }
    }),
})
