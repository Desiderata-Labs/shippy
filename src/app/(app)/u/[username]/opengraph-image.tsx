import { prisma } from '@/lib/db/server'
import {
  OpenGraphImage,
  contentType,
  size,
} from '@/components/app/opengraph-image'

export const alt = 'User Profile on Shippy'
export { size, contentType }

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const user = await prisma.user.findUnique({
    where: { username },
    select: { name: true, username: true },
  })

  if (!user) {
    return OpenGraphImage({
      title: 'User Not Found',
    })
  }

  const displayName = user.name ?? user.username ?? 'this user'
  const possessive = displayName.toLowerCase().endsWith('s') ? "'" : "'s"

  return OpenGraphImage({
    title: `@${user.username}`,
    description: `View ${displayName}${possessive} profile and contributions on Shippy.`,
    badge: 'Contributor',
  })
}
