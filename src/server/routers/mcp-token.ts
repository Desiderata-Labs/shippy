import { generateMcpToken } from '@/lib/mcp-token/server'
import { nanoId } from '@/lib/nanoid/zod'
import { protectedProcedure, router, userError } from '@/server/trpc'
import { z } from 'zod/v4'

// Maximum tokens per user to prevent abuse
const MAX_TOKENS_PER_USER = 10

export const mcpTokenRouter = router({
  /**
   * List all MCP tokens for the current user
   * (Only returns metadata, never the actual token)
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.mcpAccessToken.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    })
  }),

  /**
   * Create a new MCP token
   * Returns the raw token ONCE - it cannot be retrieved again
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        expiresAt: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check token limit
      const existingCount = await ctx.prisma.mcpAccessToken.count({
        where: { userId: ctx.user.id },
      })

      if (existingCount >= MAX_TOKENS_PER_USER) {
        throw userError(
          'BAD_REQUEST',
          `You can have at most ${MAX_TOKENS_PER_USER} tokens. Please delete an existing token first.`,
        )
      }

      const { rawToken, tokenHash } = generateMcpToken()

      const token = await ctx.prisma.mcpAccessToken.create({
        data: {
          userId: ctx.user.id,
          tokenHash,
          name: input.name,
          expiresAt: input.expiresAt,
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      })

      // Return the raw token ONCE
      return {
        ...token,
        rawToken,
      }
    }),

  /**
   * Delete an MCP token
   */
  delete: protectedProcedure
    .input(z.object({ id: nanoId() }))
    .mutation(async ({ ctx, input }) => {
      const token = await ctx.prisma.mcpAccessToken.findUnique({
        where: { id: input.id },
        select: { userId: true },
      })

      if (!token) {
        throw userError('NOT_FOUND', 'Token not found')
      }

      if (token.userId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'You can only delete your own tokens')
      }

      await ctx.prisma.mcpAccessToken.delete({
        where: { id: input.id },
      })

      return { success: true }
    }),
})
