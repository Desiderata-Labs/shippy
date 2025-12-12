import { slugify } from '@/lib/slugify'

/**
 * Username validation constants
 */
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 30
export const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

/**
 * Reserved usernames that cannot be used
 */
export const RESERVED_USERNAMES = new Set([
  // Platform routes
  'admin',
  'api',
  'auth',
  'dashboard',
  'discover',
  'help',
  'login',
  'logout',
  'onboarding',
  'project',
  'projects',
  'settings',
  'sign-in',
  'sign-up',
  'signup',
  'signin',
  // Common reserved
  'about',
  'blog',
  'contact',
  'docs',
  'home',
  'legal',
  'privacy',
  'support',
  'terms',
  // Brand protection
  'earnaslice',
  'earn-a-slice',
  'shippy',
])

/**
 * Convert a name/string into a URL-friendly username slug
 * @param input - The input string (usually user's name)
 * @returns A URL-safe slug suitable for use as a username
 */
export function slugifyUsername(input: string): string {
  return slugify(input, USERNAME_MAX_LENGTH)
}

/**
 * Validate a username string
 * @param username - The username to validate
 * @returns An object with isValid and error message if invalid
 */
export function validateUsername(username: string): {
  isValid: boolean
  error?: string
} {
  if (!username || typeof username !== 'string') {
    return { isValid: false, error: 'Username is required' }
  }

  const trimmed = username.trim().toLowerCase()

  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return {
      isValid: false,
      error: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
    }
  }

  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Username must be at most ${USERNAME_MAX_LENGTH} characters`,
    }
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error:
        'Username can only contain lowercase letters, numbers, and dashes (cannot start or end with a dash)',
    }
  }

  if (RESERVED_USERNAMES.has(trimmed)) {
    return { isValid: false, error: 'This username is reserved' }
  }

  return { isValid: true }
}
