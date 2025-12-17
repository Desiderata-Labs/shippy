import { isValidHexColor } from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/zod'
import { createLabel, listLabels, updateLabel } from '@/server/services/label'
import {
  protectedProcedure,
  publicProcedure,
  router,
  userError,
} from '@/server/trpc'
import { z } from 'zod/v4'

// Custom Zod validator for hex colors
const hexColorSchema = z.string().refine(isValidHexColor, {
  message: 'Invalid hex color format (expected #RRGGBB)',
})

// Validation schemas
const createLabelSchema = z.object({
  projectId: nanoId(),
  name: z.string().min(1).max(50),
  color: hexColorSchema,
})

const updateLabelSchema = z.object({
  id: nanoId(),
  name: z.string().min(1).max(50).optional(),
  color: hexColorSchema.optional(),
})

export const labelRouter = router({
  /**
   * Get labels for a project
   */
  getByProject: publicProcedure
    .input(z.object({ projectId: nanoId() }))
    .query(async ({ ctx, input }) => {
      const result = await listLabels({
        prisma: ctx.prisma,
        projectId: input.projectId,
      })

      if (!result.success) {
        throw userError('NOT_FOUND', result.message)
      }

      return result.labels
    }),

  /**
   * Create a label (founder only)
   */
  create: protectedProcedure
    .input(createLabelSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await createLabel({
        prisma: ctx.prisma,
        projectId: input.projectId,
        userId: ctx.user.id,
        name: input.name,
        color: input.color,
      })

      if (!result.success) {
        const errorMap: Record<
          string,
          'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'BAD_REQUEST'
        > = {
          NOT_FOUND: 'NOT_FOUND',
          FORBIDDEN: 'FORBIDDEN',
          CONFLICT: 'CONFLICT',
          INVALID_COLOR: 'BAD_REQUEST',
        }
        throw userError(errorMap[result.code] ?? 'BAD_REQUEST', result.message)
      }

      return result.label
    }),

  /**
   * Update a label (founder only)
   */
  update: protectedProcedure
    .input(updateLabelSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      const result = await updateLabel({
        prisma: ctx.prisma,
        labelId: id,
        userId: ctx.user.id,
        data,
      })

      if (!result.success) {
        const errorMap: Record<
          string,
          'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'BAD_REQUEST'
        > = {
          NOT_FOUND: 'NOT_FOUND',
          FORBIDDEN: 'FORBIDDEN',
          CONFLICT: 'CONFLICT',
          INVALID_COLOR: 'BAD_REQUEST',
          NO_CHANGES: 'BAD_REQUEST',
        }
        throw userError(errorMap[result.code] ?? 'BAD_REQUEST', result.message)
      }

      return result.label
    }),

  /**
   * Delete a label (founder only)
   */
  delete: protectedProcedure
    .input(z.object({ id: nanoId() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership via project
      const label = await ctx.prisma.label.findUnique({
        where: { id: input.id },
        include: { project: { select: { founderId: true } } },
      })

      if (!label) {
        throw userError('NOT_FOUND', 'Label not found')
      }

      if (label.project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'You do not own this project')
      }

      await ctx.prisma.label.delete({
        where: { id: input.id },
      })

      return { success: true }
    }),
})
