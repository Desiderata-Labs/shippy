import { BountyStatus } from '@/lib/db/types'
import {
  isUsernameAvailable,
  setUserUsername,
  slugifyUsername,
  validateUsername,
} from '@/lib/username/server'
import {
  protectedProcedure,
  publicProcedure,
  router,
  userError,
} from '@/server/trpc'
import { z } from 'zod'

/**
 * Maximum number of users to return in search results
 */
const SEARCH_LIMIT = 10

export const userRouter = router({
  /**
   * Search users by username or name (for @mention autocomplete)
   */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const searchQuery = input.query.toLowerCase()

      // Search by username (primary) or name (secondary)
      const users = await ctx.prisma.user.findMany({
        where: {
          AND: [
            // Must have a username to be mentionable
            { username: { not: null } },
            // Match query
            {
              OR: [
                { username: { contains: searchQuery, mode: 'insensitive' } },
                { name: { contains: searchQuery, mode: 'insensitive' } },
              ],
            },
          ],
        },
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
        take: SEARCH_LIMIT,
        orderBy: [
          // Prioritize exact username match, then prefix match
          { username: 'asc' },
        ],
      })

      return users
    }),
  /**
   * Get a user's public profile by username
   */
  getByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { username: input.username },
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
          createdAt: true,
        },
      })

      if (!user) {
        throw userError('NOT_FOUND', 'User not found')
      }

      return user
    }),

  /**
   * Get a user's public projects by username
   */
  getPublicProjects: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { username: input.username },
        select: { id: true },
      })

      if (!user) {
        throw userError('NOT_FOUND', 'User not found')
      }

      return ctx.prisma.project.findMany({
        where: {
          founderId: user.id,
          isPublic: true,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          founder: {
            select: { id: true, name: true, image: true },
          },
          rewardPool: true,
          _count: {
            select: {
              bounties: { where: { status: BountyStatus.OPEN } },
            },
          },
        },
      })
    }),

  /**
   * Check if a username is available
   */
  checkUsernameAvailable: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Always slugify to match what will be saved
      const normalizedUsername = slugifyUsername(input.username)

      // Validate format first
      const validation = validateUsername(normalizedUsername)
      if (!validation.isValid) {
        return {
          available: false,
          error: validation.error,
        }
      }

      // Check database availability (exclude current user if logged in)
      const available = await isUsernameAvailable(
        normalizedUsername,
        ctx.user?.id,
      )

      return {
        available,
        error: available ? undefined : 'This username is already taken',
      }
    }),

  /**
   * Get the current user's profile info (including username status)
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        image: true,
        createdAt: true,
      },
    })

    return {
      user,
      needsOnboarding: !user?.username,
    }
  }),

  /**
   * Set or update the current user's username
   */
  setUsername: protectedProcedure
    .input(
      z.object({
        username: z.string().min(3).max(30),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const updatedUser = await setUserUsername(ctx.user.id, input.username)

      return {
        success: true,
        username: updatedUser.username,
      }
    }),

  /**
   * Update the current user's profile (name)
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const updatedUser = await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { name: input.name.trim() },
        select: {
          id: true,
          name: true,
          username: true,
        },
      })

      return {
        success: true,
        user: updatedUser,
      }
    }),
})
