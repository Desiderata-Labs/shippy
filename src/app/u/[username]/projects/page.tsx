import type { Metadata } from 'next'
import { UserProjectsContent } from './_content'

export const metadata: Metadata = {
  title: 'My Projects',
}

export default function UserProjectsPage() {
  return <UserProjectsContent />
}
