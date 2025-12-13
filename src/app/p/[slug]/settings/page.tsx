import type { Metadata } from 'next'
import { ProjectSettingsContent } from './_content'

export const metadata: Metadata = {
  title: 'Project Settings',
}

export default function ProjectSettingsPage() {
  return <ProjectSettingsContent />
}
