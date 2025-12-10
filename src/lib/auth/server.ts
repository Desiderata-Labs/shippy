import { prisma } from '@/lib/db/server'
import { BetterAuthOptions, betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import 'server-only'
import { v4 as uuidv4 } from 'uuid'

// Base URL for auth - uses environment variable or falls back to localhost
function getBaseUrl(): string {
  const env = process.env as Record<string, string | undefined>
  return (
    env['BETTER_AUTH_URL'] ||
    env['NEXT_PUBLIC_APP_URL'] ||
    'http://localhost:3050'
  )
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
  advanced: {
    cookiePrefix: 'eas',
    useSecureCookies: process.env.NODE_ENV === 'production',
    database: {
      generateId: () => uuidv4(),
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
  plugins: [nextCookies()], // Must be last plugin
} satisfies BetterAuthOptions

export const auth = betterAuth(authConfig)

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
