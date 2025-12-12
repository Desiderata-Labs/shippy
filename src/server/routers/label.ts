import { isValidHexColor } from '@/lib/db/types'
import { protectedProcedure, publicProcedure, router } from '@/server/trpc'
import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'

// Custom Zod validator for hex colors
const hexColorSchema = z.string().refine(isValidHexColor, {
  message: 'Invalid hex color format (expected #RRGGBB)',
})

// Validation schemas
const createLabelSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(50),
  color: hexColorSchema,
})

const updateLabelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50).optional(),
  color: hexColorSchema.optional(),
})

export const labelRouter = router({
  /**
   * Get labels for a project
   */
  getByProject: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.label.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: 'asc' },
      })
    }),

  /**
   * Create a label (founder only)
   */
  create: protectedProcedure
    .input(createLabelSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify project ownership
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { founderId: true },
      })

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      if (project.founderId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not own this project',
        })
      }

      // Check for duplicate name
      const existing = await ctx.prisma.label.findUnique({
        where: {
          projectId_name: {
            projectId: input.projectId,
            name: input.name,
          },
        },
      })

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A label with this name already exists',
        })
      }

      return ctx.prisma.label.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          color: input.color,
        },
      })
    }),

  /**
   * Update a label (founder only)
   */
  update: protectedProcedure
    .input(updateLabelSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      // Verify ownership via project
      const label = await ctx.prisma.label.findUnique({
        where: { id },
        include: { project: { select: { founderId: true } } },
      })

      if (!label) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Label not found' })
      }

      if (label.project.founderId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not own this project',
        })
      }

      // If changing name, check for duplicates
      if (data.name && data.name !== label.name) {
        const existing = await ctx.prisma.label.findUnique({
          where: {
            projectId_name: {
              projectId: label.projectId,
              name: data.name,
            },
          },
        })

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A label with this name already exists',
          })
        }
      }

      return ctx.prisma.label.update({
        where: { id },
        data,
      })
    }),

  /**
   * Delete a label (founder only)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership via project
      const label = await ctx.prisma.label.findUnique({
        where: { id: input.id },
        include: { project: { select: { founderId: true } } },
      })

      if (!label) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Label not found' })
      }

      if (label.project.founderId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not own this project',
        })
      }

      await ctx.prisma.label.delete({
        where: { id: input.id },
      })

      return { success: true }
    }),
})
