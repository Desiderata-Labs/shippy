import type { Metadata } from 'next'
import { prisma } from '@/lib/db/server'
import { UserProfileContent } from './_content'

interface PageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username } = await params

  const user = await prisma.user.findUnique({
    where: { username },
    select: { name: true },
  })

  if (!user) {
    return { title: 'User Not Found' }
  }

  return { title: user.name }
}

export default function UserProfilePage() {
  return <UserProfileContent />
}
