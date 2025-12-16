import { prisma } from '@/lib/db/server'
import { generateNanoId } from '@/lib/nanoid/server'
import { generateUniqueUsername } from '@/lib/username/server'
import { BetterAuthOptions, betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import 'server-only'

// Base URL for auth - uses environment variable or falls back to localhost
function getBaseUrl(): string {
  const env = process.env as Record<string, string | undefined>
  return (
    env['BETTER_AUTH_URL'] ||
    env['NEXT_PUBLIC_APP_URL'] ||
    'http://localhost:3050'
  )
}

/**
 * Auto-generate a username for new users based on their name.
 * If the user's name is not available or conflicts exist, username will be null
 * and they'll be redirected to onboarding to set it manually.
 */
async function generateUsernameForNewUser(userId: string, name: string | null) {
  try {
    const username = await generateUniqueUsername(name)
    if (username) {
      await prisma.user.update({
        where: { id: userId },
        data: { username },
      })
    }
  } catch (error) {
    // Log but don't fail user creation - they can set username during onboarding
    console.error('Failed to auto-generate username:', error)
  }
}

// Trusted origins for CORS/CSRF validation
const trustedOrigins = (process.env.TRUSTED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const authConfig = {
  baseURL: getBaseUrl(),
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: false,
        input: true, // Allow setting via signUp
      },
    },
  },
  advanced: {
    cookiePrefix: 'eas',
    useSecureCookies: process.env.NODE_ENV === 'production',
    database: {
      generateId: () => generateNanoId(),
    },
    cookies: {
      session_token: {
        attributes: {
          sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
          secure: process.env.NODE_ENV === 'production',
        },
      },
    },
  },
  trustedOrigins: trustedOrigins.length > 0 ? trustedOrigins : [getBaseUrl()],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14, // 14 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'github'],
    },
    // Skip state cookie check in development to avoid state_mismatch errors
    // when using ngrok or other tunneling tools
    ...(process.env.NODE_ENV !== 'production' && {
      skipStateCookieCheck: true,
    }),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Auto-generate username for new users
          await generateUsernameForNewUser(user.id, user.name)
        },
      },
    },
  },
  plugins: [nextCookies()], // Must be last plugin
} satisfies BetterAuthOptions

export const auth = betterAuth(authConfig)

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
