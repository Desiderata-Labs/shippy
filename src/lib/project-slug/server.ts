import { prisma } from '@/lib/db/server'
import { RESERVED_PROJECT_SLUGS, isAdminEmail } from './shared'
import 'server-only'

/**
 * Check if a project slug is available in the database
 * @param slug - The slug to check
 * @param options - Optional configuration
 * @param options.excludeProjectId - Project ID to exclude (for updating own project)
 * @param options.userEmail - User email to check for admin privileges
 * @returns true if available, false if taken
 */
export async function isProjectSlugAvailable(
  slug: string,
  options?: {
    excludeProjectId?: string
    userEmail?: string | null
  },
): Promise<boolean> {
  const normalizedSlug = slug.toLowerCase().trim()

  // Check reserved slugs first (admins can bypass)
  if (
    RESERVED_PROJECT_SLUGS.has(normalizedSlug) &&
    !isAdminEmail(options?.userEmail)
  ) {
    return false
  }

  const existingProject = await prisma.project.findFirst({
    where: {
      slug: normalizedSlug,
      ...(options?.excludeProjectId
        ? { NOT: { id: options.excludeProjectId } }
        : {}),
    },
    select: { id: true },
  })

  return !existingProject
}

// Re-export shared utilities for convenience
export { slugifyProjectSlug, validateProjectSlug } from './shared'
