import type { Metadata } from 'next'
import { OnboardingContent } from './_components/onboarding-content'

export const metadata: Metadata = {
  title: 'Choose Username',
}

export default function OnboardingPage() {
  return <OnboardingContent />
}
