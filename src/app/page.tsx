import { ComparisonSection } from '@/components/marketing/comparison-section'
import { CtaSection } from '@/components/marketing/cta-section'
import { FeaturesSection } from '@/components/marketing/features-section'
import { HeroSection } from '@/components/marketing/hero-section'
import { HowItWorksSection } from '@/components/marketing/how-it-works-section'
import { SiteFooter } from '@/components/marketing/site-footer'

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <ComparisonSection />
      <CtaSection />
      <SiteFooter />
    </div>
  )
}
