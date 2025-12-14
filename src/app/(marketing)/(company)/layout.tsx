'use client'

import { Header } from '@/components/layout/header'
import {
  ParticleBackground,
  ParticleIntensity,
} from '@/components/marketing/particle-background'
import { SiteFooter } from '@/components/marketing/site-footer'

/**
 * Shared layout for company pages (legal, media kit, etc.)
 * Features a particle background with a card container for content.
 */
export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen w-full bg-muted dark:bg-background">
      {/* Particles in the background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <ParticleBackground intensity={ParticleIntensity.Hero} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header padded />

        {/* Main content container */}
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
          <div className="overflow-hidden rounded-xl border bg-card p-6 sm:p-8">
            {children}
          </div>
        </div>

        <SiteFooter />
      </div>
    </div>
  )
}
