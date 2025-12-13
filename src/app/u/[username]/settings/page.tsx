import type { Metadata } from 'next'
import { UserSettingsContent } from './_content'

export const metadata: Metadata = {
  title: 'Settings',
}

export default function UserSettingsPage() {
  return <UserSettingsContent />
}
