'use client'

import { useParams } from 'next/navigation'
import { ProjectEditor } from '@/components/project/project-editor'

export function NewProjectContent() {
  const params = useParams<{ username: string }>()

  return <ProjectEditor mode="create" username={params.username} />
}
