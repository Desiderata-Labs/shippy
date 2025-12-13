import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { ComparisonSection } from '@/components/marketing/comparison-section'
import { CtaSection } from '@/components/marketing/cta-section'
import { FeaturesSection } from '@/components/marketing/features-section'
import { HeroSection } from '@/components/marketing/hero-section'
import { HowItWorksSection } from '@/components/marketing/how-it-works-section'
import { SiteFooter } from '@/components/marketing/site-footer'
import { TrustSection } from '@/components/marketing/trust-section'

export const metadata: Metadata = {
  title: 'Shippy - Ship work. Earn royalties.',
}

export default function HomePage() {
  return (
    <main className="flex flex-col overflow-x-clip">
      <Header padded />
      <HeroSection />
      <TrustSection />
      <HowItWorksSection />
      <FeaturesSection />
      <ComparisonSection />
      <CtaSection />
      <SiteFooter />
    </main>
  )
}
