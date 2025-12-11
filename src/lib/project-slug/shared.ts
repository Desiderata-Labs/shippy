import { slugify } from '@/lib/slugify'

/**
 * Project slug validation constants
 */
export const PROJECT_SLUG_MIN_LENGTH = 2
export const PROJECT_SLUG_MAX_LENGTH = 50
export const PROJECT_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

/**
 * Admin emails that can use reserved slugs
 */
export const ADMIN_EMAILS = new Set(['rob@robphillips.me'])

/**
 * Reserved project slugs that cannot be used
 */
export const RESERVED_PROJECT_SLUGS = new Set([
  // Platform routes
  'admin',
  'api',
  'new',
  'create',
  'edit',
  'settings',
  'dashboard',
  // Common reserved
  'example',
  'test',
  'demo',
  // Brand protection
  'earnaslice',
  'earn-a-slice',
  // Reserved project names
  'oath',
  'oath-notes',
  'oath-challenges',
  'innerview',
  'stackwise',
  'growpilot',
  'super-school',
  'superschool',
])

/**
 * Convert a project name into a URL-friendly slug
 * @param input - The project name
 * @returns A URL-safe slug suitable for use as a project slug
 */
export function slugifyProjectSlug(input: string): string {
  return slugify(input, PROJECT_SLUG_MAX_LENGTH)
}

/**
 * Check if an email is an admin email that can bypass reserved slug restrictions
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase())
}

/**
 * Validate a project slug string
 * @param slug - The slug to validate
 * @param userEmail - Optional user email to check for admin privileges
 * @returns An object with isValid and error message if invalid
 */
export function validateProjectSlug(
  slug: string,
  userEmail?: string | null,
): {
  isValid: boolean
  error?: string
} {
  if (!slug || typeof slug !== 'string') {
    return { isValid: false, error: 'Slug is required' }
  }

  const trimmed = slug.trim().toLowerCase()

  if (trimmed.length < PROJECT_SLUG_MIN_LENGTH) {
    return {
      isValid: false,
      error: `Slug must be at least ${PROJECT_SLUG_MIN_LENGTH} characters`,
    }
  }

  if (trimmed.length > PROJECT_SLUG_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Slug must be at most ${PROJECT_SLUG_MAX_LENGTH} characters`,
    }
  }

  if (!PROJECT_SLUG_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error:
        'Slug can only contain lowercase letters, numbers, and dashes (cannot start or end with a dash)',
    }
  }

  // Allow admins to use reserved slugs
  if (RESERVED_PROJECT_SLUGS.has(trimmed) && !isAdminEmail(userEmail)) {
    return { isValid: false, error: 'This slug is reserved' }
  }

  return { isValid: true }
}
