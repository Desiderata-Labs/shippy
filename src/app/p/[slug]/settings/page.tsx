'use client'

import { useParams } from 'next/navigation'
import { ProjectEditor } from '@/components/project/project-editor'

export default function ProjectSettingsPage() {
  const params = useParams<{ slug: string }>()

  return <ProjectEditor mode="edit" slug={params.slug} />
}
