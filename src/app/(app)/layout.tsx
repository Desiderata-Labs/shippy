'use client'

import { Header } from '@/components/layout/header'
import {
  ParticleBackground,
  ParticleIntensity,
} from '@/components/marketing/particle-background'

/**
 * Layout for app pages with a dark frame and lighter rounded content area.
 * The outer frame is fixed height (viewport), header sits at top,
 * and the content area scrolls independently.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-muted dark:bg-background">
      {/* Particles in the frame area - absolute positioned, behind content */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <ParticleBackground intensity={ParticleIntensity.Hero} />
      </div>

      {/* Header sits in the dark frame - not sticky, just at top */}
      <div className="relative z-10">
        <Header variant="app" />
      </div>

      {/* Content wrapper with padding for the frame */}
      <div className="relative z-10 flex min-h-0 flex-1 justify-center px-2 pb-2 sm:px-3 sm:pb-3">
        {/* Rounded content container - this is where scrolling happens */}
        <div className="flex w-full max-w-7xl flex-col overflow-hidden rounded-lg border bg-card">
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  )
}
