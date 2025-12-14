import { prisma } from '@/lib/db/server'
import {
  OpenGraphImage,
  contentType,
  size,
} from '@/components/app/opengraph-image'

export const alt = 'Project on Shippy'
export { size, contentType }

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { name: true, tagline: true },
  })

  if (!project) {
    return OpenGraphImage({
      title: 'Project Not Found',
    })
  }

  return OpenGraphImage({
    title: project.name,
    description: project.tagline,
    badge: 'Project',
  })
}
