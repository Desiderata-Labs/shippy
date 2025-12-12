import { prisma } from '@/lib/db/server'
import { normalizeProjectKey } from './shared'
import 'server-only'

export async function isProjectKeyAvailable(
  founderId: string,
  projectKey: string,
  options?: { excludeProjectId?: string },
): Promise<boolean> {
  const normalized = normalizeProjectKey(projectKey)
  if (normalized.length !== 3) return false

  const existing = await prisma.project.findFirst({
    where: {
      founderId,
      projectKey: normalized,
      ...(options?.excludeProjectId
        ? { NOT: { id: options.excludeProjectId } }
        : {}),
    },
    select: { id: true },
  })

  return !existing
}
