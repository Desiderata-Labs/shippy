import { prisma } from '@/lib/db/server'
import { extractNanoIdFromSlug } from '@/lib/nanoid/shared'
import {
  OpenGraphImage,
  contentType,
  size,
} from '@/components/app/opengraph-image'

export const alt = 'Bounty on Shippy'
export { size, contentType }

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; bountyId: string }>
}) {
  const { slug, bountyId: bountySlug } = await params
  const bountyId = extractNanoIdFromSlug(bountySlug)

  const bounty = await prisma.bounty.findUnique({
    where: { id: bountyId },
    select: {
      title: true,
      points: true,
      status: true,
      project: {
        select: {
          name: true,
        },
      },
    },
  })

  if (!bounty) {
    // Fall back to project OG image data
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { name: true, tagline: true },
    })

    if (!project) {
      return OpenGraphImage({
        title: 'Bounty Not Found',
      })
    }

    return OpenGraphImage({
      title: 'Bounty Not Found',
      description: project.name,
    })
  }

  // Build points and status line
  const parts: string[] = []
  if (bounty.points) {
    parts.push(`${bounty.points} points`)
  }
  if (bounty.status) {
    const statusLabel =
      bounty.status.charAt(0) + bounty.status.slice(1).toLowerCase()
    parts.push(statusLabel)
  }
  const pointsAndStatus = parts.length > 0 ? parts.join(' · ') : null

  return OpenGraphImage({
    title: bounty.title,
    description: pointsAndStatus,
    badge: bounty.project.name,
  })
}
