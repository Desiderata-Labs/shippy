import { headers } from 'next/headers'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/server'
import { generateNanoId } from '@/lib/nanoid/server'
import { TRPCError, initTRPC } from '@trpc/server'
import type { TRPC_ERROR_CODE_KEY } from '@trpc/server/rpc'
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

// Error codes that are "expected" and don't need logging with error IDs
const EXPECTED_ERROR_CODES = new Set([
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'BAD_REQUEST',
  'CONFLICT',
])

// User-friendly error messages by code
const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'You need to sign in to do that.',
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: 'The requested resource was not found.',
  BAD_REQUEST: 'Invalid request.',
  CONFLICT: 'This action conflicts with the current state.',
  TOO_MANY_REQUESTS: 'Too many requests. Please slow down.',
  TIMEOUT: 'The request timed out. Please try again.',
  INTERNAL_SERVER_ERROR: 'Something went wrong on our end.',
}

// Symbol to mark errors as user-safe (not exported, internal use only)
const USER_SAFE_ERROR = Symbol('userSafeError')

interface UserSafeErrorCause {
  [USER_SAFE_ERROR]: true
}

/**
 * Check if an error was created with userError() and is safe to show
 */
function isUserSafeError(error: TRPCError): boolean {
  if (!error.cause || typeof error.cause !== 'object') return false
  return (
    (error.cause as unknown as UserSafeErrorCause)[USER_SAFE_ERROR] === true
  )
}

/**
 * Create a TRPCError with a message that's safe to show to users.
 * Use this instead of `new TRPCError()` when the message is meant for user display.
 *
 * @example
 * throw userError('NOT_FOUND', 'Bounty not found')
 * throw userError('BAD_REQUEST', 'You have already claimed this bounty')
 * throw userError('CONFLICT', 'This bounty has reached its maximum number of claims')
 */
export function userError(
  code: TRPC_ERROR_CODE_KEY,
  message: string,
): TRPCError {
  return new TRPCError({
    code,
    message,
    cause: { [USER_SAFE_ERROR]: true },
  })
}

/**
 * Initialize tRPC with error formatting
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const code = shape.data.code as string
    const isExpected = EXPECTED_ERROR_CODES.has(code)

    // For unexpected errors, generate an error ID and log it
    let errorId: string | undefined
    if (!isExpected) {
      errorId = generateNanoId().slice(0, 8) // Short ID for easy reference
      console.error(`[API Error ${errorId}]`, {
        errorId,
        code,
        message: error.message,
        cause: error.cause,
        stack: error.stack,
        path: shape.data.path,
      })
    }

    // Determine safe message for client:
    // - If error was created with userError(), use the original message
    // - Otherwise, use a generic message based on the error code
    const safeMessage = isUserSafeError(error)
      ? error.message
      : ERROR_MESSAGES[code] || 'Something went wrong.'

    return {
      ...shape,
      message: safeMessage,
      data: {
        ...shape.data,
        errorId, // User can quote this in support requests
        zodError: null, // Hide validation details in production
        stack: undefined, // Never expose stack traces
      },
    }
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
