'use client'

import { useEffect, useRef } from 'react'

export enum ParticleIntensity {
  /** Hero section - full intensity */
  Hero = 'hero',
  /** Subtle background for other sections */
  Subtle = 'subtle',
}

interface ParticleBackgroundProps {
  intensity?: ParticleIntensity
  className?: string
}

// Configuration per intensity level
const CONFIG = {
  [ParticleIntensity.Hero]: {
    particleCount: 60,
    speed: 0.15,
    opacity: 0.5,
    connectionOpacity: 0.12,
    connectionDistance: 120,
  },
  [ParticleIntensity.Subtle]: {
    particleCount: 30,
    speed: 0.08,
    opacity: 0.25,
    connectionOpacity: 0.06,
    connectionDistance: 100,
  },
}

// Particle state for canvas animation
interface ParticleState {
  x: number
  y: number
  vx: number
  vy: number
  baseVx: number
  baseVy: number
  size: number
  opacity: number
}

function createParticle(
  width: number,
  height: number,
  speed: number,
  baseOpacity: number,
): ParticleState {
  const angle = Math.random() * Math.PI * 2
  const particleSpeed = Math.random() * speed + speed * 0.5
  const vx = Math.cos(angle) * particleSpeed
  const vy = Math.sin(angle) * particleSpeed

  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx,
    vy,
    baseVx: vx,
    baseVy: vy,
    size: Math.random() * 2 + 1,
    opacity: Math.random() * baseOpacity + baseOpacity * 0.4,
  }
}

function updateParticle(
  p: ParticleState,
  width: number,
  height: number,
  mouse: { x: number; y: number },
  mouseRadius: number,
) {
  // Mouse repulsion
  const dx = mouse.x - p.x
  const dy = mouse.y - p.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < mouseRadius && dist > 0) {
    const force = (mouseRadius - dist) / mouseRadius
    p.vx -= (dx / dist) * force * 0.02
    p.vy -= (dy / dist) * force * 0.02
  }

  // Gradually return to base velocity for continuous movement
  p.vx += (p.baseVx - p.vx) * 0.008
  p.vy += (p.baseVy - p.vy) * 0.008

  // Add slight random drift for organic feel
  p.vx += (Math.random() - 0.5) * 0.005
  p.vy += (Math.random() - 0.5) * 0.005

  // Update position
  p.x += p.vx
  p.y += p.vy

  // Wrap around edges (seamless looping)
  if (p.x < -10) p.x = width + 10
  if (p.x > width + 10) p.x = -10
  if (p.y < -10) p.y = height + 10
  if (p.y > height + 10) p.y = -10
}

function drawParticle(ctx: CanvasRenderingContext2D, p: ParticleState) {
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(74, 144, 226, ${p.opacity})`
  ctx.fill()
}

export function ParticleBackground({
  intensity = ParticleIntensity.Hero,
  className = '',
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const config = CONFIG[intensity]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let particles: ParticleState[] = []
    const mouseRadius = 120

    let mouse = { x: -1000, y: -1000 }

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    const init = () => {
      resize()
      particles = []
      for (let i = 0; i < config.particleCount; i++) {
        particles.push(
          createParticle(
            canvas.offsetWidth,
            canvas.offsetHeight,
            config.speed,
            config.opacity,
          ),
        )
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)

      // Update and draw particles
      for (const particle of particles) {
        updateParticle(
          particle,
          canvas.offsetWidth,
          canvas.offsetHeight,
          mouse,
          mouseRadius,
        )
        drawParticle(ctx, particle)
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < config.connectionDistance) {
            const opacity =
              (1 - dist / config.connectionDistance) * config.connectionOpacity
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(74, 144, 226, ${opacity})`
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }

    const handleMouseLeave = () => {
      mouse = { x: -1000, y: -1000 }
    }

    init()
    animate()

    window.addEventListener('resize', init)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', init)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [config])

  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`}>
      {/* Particles canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 size-full"
      />
    </div>
  )
}
