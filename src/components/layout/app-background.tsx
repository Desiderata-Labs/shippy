'use client'

import {
  ParticleBackground,
  ParticleIntensity,
} from '@/components/marketing/particle-background'
import { Header } from './header'

interface AppBackgroundProps {
  children: React.ReactNode
  /** Whether to show the header. Defaults to true. */
  showHeader?: boolean
}

/**
 * Shared background for all app pages (non-landing).
 * Includes AppHeader, subtle particle animation, and gradient background.
 */
export function AppBackground({
  children,
  showHeader = true,
}: AppBackgroundProps) {
  return (
    <div className="relative min-h-screen">
      {/* Particles */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <ParticleBackground intensity={ParticleIntensity.Subtle} />
      </div>

      {/* Header */}
      {showHeader && <Header />}

      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  )
}
