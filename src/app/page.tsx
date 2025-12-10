import { ComparisonSection } from '@/components/marketing/comparison-section'
import { CtaSection } from '@/components/marketing/cta-section'
import { FeaturesSection } from '@/components/marketing/features-section'
import { HeroSection } from '@/components/marketing/hero-section'
import { HowItWorksSection } from '@/components/marketing/how-it-works-section'
import { SiteFooter } from '@/components/marketing/site-footer'
import { TrustSection } from '@/components/marketing/trust-section'

export default function HomePage() {
  return (
    <main className="flex flex-col overflow-x-clip">
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
