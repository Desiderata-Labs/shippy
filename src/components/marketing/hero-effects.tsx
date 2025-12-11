'use client'

import { ParticleBackground, ParticleIntensity } from './particle-background'

export function HeroEffects() {
  return <ParticleBackground intensity={ParticleIntensity.Hero} />
}
