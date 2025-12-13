import type { Metadata } from 'next'
import { NewProjectContent } from './_content'

export const metadata: Metadata = {
  title: 'Create Project',
}

export default function NewProjectPage() {
  return <NewProjectContent />
}
