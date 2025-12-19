import type { Metadata } from 'next'
import { EditPoolContent } from './_content'

export const metadata: Metadata = {
  title: 'Edit Pool',
}

export default function EditPoolPage() {
  return <EditPoolContent />
}
