import { prisma } from '@/lib/db/server'
import { RESERVED_USERNAMES, slugifyUsername, validateUsername } from './shared'
import 'server-only'

/**
 * Check if a username is available in the database
 * @param username - The username to check
 * @param excludeUserId - Optional user ID to exclude (for updating own username)
 * @returns true if available, false if taken
 */
export async function isUsernameAvailable(
  username: string,
  excludeUserId?: string,
): Promise<boolean> {
  const normalizedUsername = username.toLowerCase().trim()

  // Check reserved usernames first
  if (RESERVED_USERNAMES.has(normalizedUsername)) {
    return false
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      username: normalizedUsername,
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
    select: { id: true },
  })

  return !existingUser
}

/**
 * Generate a unique username from a name, appending numbers if necessary
 * @param name - The user's name to base the username on
 * @param maxAttempts - Maximum number of attempts to find a unique username
 * @returns A unique username or null if unable to generate one
 */
export async function generateUniqueUsername(
  name: string | null | undefined,
  maxAttempts = 100,
): Promise<string | null> {
  // If no name provided, we can't generate a username
  if (!name || name.trim().length === 0) {
    return null
  }

  const baseUsername = slugifyUsername(name)

  // If base username is too short or invalid, return null
  const validation = validateUsername(baseUsername)
  if (!validation.isValid && baseUsername.length < 2) {
    return null
  }

  // Try the base username first
  if (validation.isValid && (await isUsernameAvailable(baseUsername))) {
    return baseUsername
  }

  // Try appending numbers
  for (let i = 1; i <= maxAttempts; i++) {
    const candidateUsername = `${baseUsername}-${i}`
    const candidateValidation = validateUsername(candidateUsername)

    if (
      candidateValidation.isValid &&
      (await isUsernameAvailable(candidateUsername))
    ) {
      return candidateUsername
    }
  }

  // If all attempts failed, try with random suffix
  const randomSuffix = Math.random().toString(36).substring(2, 6)
  const randomUsername = `${baseUsername}-${randomSuffix}`
  const randomValidation = validateUsername(randomUsername)

  if (randomValidation.isValid && (await isUsernameAvailable(randomUsername))) {
    return randomUsername
  }

  return null
}

/**
 * Set or update a user's username
 * @param userId - The user's ID
 * @param username - The desired username
 * @returns The updated user or throws an error
 */
export async function setUserUsername(userId: string, username: string) {
  // Always slugify the username to ensure it's URL-safe
  // This handles cases like "rob phillips" -> "rob-phillips"
  const normalizedUsername = slugifyUsername(username)

  // Validate the slugified username
  const validation = validateUsername(normalizedUsername)
  if (!validation.isValid) {
    throw new Error(validation.error)
  }

  // Check availability (excluding current user)
  const available = await isUsernameAvailable(normalizedUsername, userId)
  if (!available) {
    throw new Error('This username is already taken')
  }

  // Update the user
  return prisma.user.update({
    where: { id: userId },
    data: { username: normalizedUsername },
  })
}

// Re-export shared utilities for convenience
export { slugifyUsername, validateUsername } from './shared'
