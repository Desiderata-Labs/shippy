import { headers } from 'next/headers'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/server'
import { TRPCError, initTRPC } from '@trpc/server'
import 'server-only'
import superjson from 'superjson'

/**
 * Create context for each tRPC request
 */
export const createTRPCContext = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  return {
    prisma,
    session,
    user: session?.user ?? null,
  }
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>

/**
 * Initialize tRPC
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape
  },
})

/**
 * Create a router
 */
export const router = t.router

/**
 * Public procedure - no authentication required
 */
export const publicProcedure = t.procedure

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to perform this action',
    })
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.user,
    },
  })
})
