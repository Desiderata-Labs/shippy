'use client'

import { useParams } from 'next/navigation'
import { ProjectEditor } from '@/components/project/project-editor'

export function ProjectSettingsContent() {
  const params = useParams<{ slug: string }>()

  return <ProjectEditor mode="edit" slug={params.slug} />
}
