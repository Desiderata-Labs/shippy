import { prisma } from '@/lib/db/server'
import { createHash, randomBytes } from 'crypto'
import 'server-only'

/**
 * MCP Access Token utilities
 *
 * Tokens are formatted as: shp_<random-bytes>
 * - Prefix "shp_" enables GitHub secret scanning and token identification
 * - 32 bytes of entropy (256 bits) for security
 * - Stored as SHA-256 hash in database
 */

const TOKEN_PREFIX = 'shp_'
const TOKEN_BYTES = 32 // 256 bits of entropy

/**
 * Generate a new MCP access token
 * Returns the raw token (show to user once) and the hash (store in DB)
 */
export function generateMcpToken(): { rawToken: string; tokenHash: string } {
  const randomPart = randomBytes(TOKEN_BYTES).toString('base64url')
  const rawToken = `${TOKEN_PREFIX}${randomPart}`
  const tokenHash = hashToken(rawToken)

  return { rawToken, tokenHash }
}

/**
 * Hash a token for storage/lookup
 * Uses SHA-256 for fast, secure hashing
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

/**
 * Verify a token and return the associated user if valid
 */
export async function verifyMcpToken(rawToken: string | undefined): Promise<{
  userId: string
  tokenId: string
  user: {
    id: string
    name: string
    username: string | null
    image: string | null
  }
} | null> {
  if (!rawToken?.startsWith(TOKEN_PREFIX)) {
    return null
  }

  const tokenHash = hashToken(rawToken)

  const tokenRecord = await prisma.mcpAccessToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
          // Note: email intentionally excluded - not needed for MCP auth
        },
      },
    },
  })

  if (!tokenRecord) {
    return null
  }

  // Check expiration
  if (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date()) {
    return null
  }

  // Update last used (fire and forget to not slow down the request)
  prisma.mcpAccessToken
    .update({
      where: { id: tokenRecord.id },
      data: { lastUsedAt: new Date() },
    })
    .catch((err: unknown) => {
      console.error('Failed to update MCP token lastUsedAt:', err)
    })

  return {
    userId: tokenRecord.userId,
    tokenId: tokenRecord.id,
    user: tokenRecord.user,
  }
}

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(
  authHeader: string | null | undefined,
): string | undefined {
  if (!authHeader?.startsWith('Bearer ')) {
    return undefined
  }
  return authHeader.slice(7)
}
