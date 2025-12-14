'use client'

import { Download01 } from '@untitled-ui/icons-react'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { domToPng } from 'modern-screenshot'

type AssetSize = {
  name: string
  width: number
  height: number
  scale: number
}

const socialAssets: AssetSize[] = [
  { name: 'LinkedIn Cover', width: 1584, height: 396, scale: 0.35 },
  { name: 'LinkedIn Company', width: 1128, height: 191, scale: 0.5 },
  { name: 'Twitter Post', width: 1200, height: 675, scale: 0.4 },
  { name: 'Twitter Header', width: 1500, height: 500, scale: 0.35 },
  { name: 'Facebook Post', width: 1200, height: 630, scale: 0.4 },
  { name: 'Facebook Cover', width: 820, height: 312, scale: 0.5 },
  { name: 'Instagram Post', width: 1080, height: 1350, scale: 0.3 },
  { name: 'Instagram Story', width: 1080, height: 1920, scale: 0.25 },
]

function AssetCard({
  name,
  width,
  height,
  scale,
}: {
  name: string
  width: number
  height: number
  scale: number
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    if (!cardRef.current) return
    setDownloading(true)

    try {
      const dataUrl = await domToPng(cardRef.current, {
        scale: 2,
      })

      const link = document.createElement('a')
      link.download = `shippy-${name.toLowerCase().replace(/\s+/g, '-')}-${width}x${height}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('Failed to capture screenshot:', error)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="relative flex max-w-full flex-col gap-3 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold">{name}</h3>
        <span className="text-sm text-muted-foreground">
          {width}×{height}px
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
          className="cursor-pointer"
        >
          {downloading ? 'Exporting...' : 'Download PNG'}
        </Button>
      </div>

      {/* Scaled preview */}
      <div className="max-w-full overflow-x-auto pb-2">
        <div
          className="overflow-hidden rounded-lg border border-border"
          style={{ width: width * scale, height: height * scale }}
        >
          <div
            style={{
              width,
              height,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <SocialCardContent width={width} height={height} />
          </div>
        </div>
      </div>

      {/* Hidden full-size element for capture - positioned off-screen */}
      <div className="pointer-events-none fixed top-0 -left-[9999px]">
        <div ref={cardRef} style={{ width, height }}>
          <SocialCardContent width={width} height={height} />
        </div>
      </div>
    </div>
  )
}

function SocialCardContent({
  width,
  height,
}: {
  width: number
  height: number
}) {
  const aspectRatio = width / height
  const isTall = aspectRatio < 1
  const isVeryWide = aspectRatio > 5
  const isWide = aspectRatio > 2.5

  // Scale everything based on card size - BIGGER sizes
  let logoMarkSize = 72
  let logoTextWidth = 188
  let logoTextHeight = 90
  let headlineSize = '5rem'
  let gap = 48

  if (isTall) {
    logoMarkSize = 96
    logoTextWidth = 252
    logoTextHeight = 120
    headlineSize = '6rem'
    gap = 56
  } else if (isVeryWide) {
    logoMarkSize = 36
    logoTextWidth = 94
    logoTextHeight = 45
    headlineSize = '2.5rem'
    gap = 20
  } else if (isWide && width < 1000) {
    logoMarkSize = 40
    logoTextWidth = 105
    logoTextHeight = 50
    headlineSize = '2.75rem'
    gap = 24
  } else if (isWide) {
    logoMarkSize = 56
    logoTextWidth = 147
    logoTextHeight = 70
    headlineSize = '3.5rem'
    gap = 32
  }

  // Generate particle positions (static dots for export)
  const particles = generateParticles(width, height, isVeryWide ? 15 : 30)

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden"
      style={{
        width,
        height,
        backgroundColor: '#1a1a1a',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Static particle dots */}
      <svg
        className="absolute inset-0"
        width={width}
        height={height}
        style={{ opacity: 0.4 }}
      >
        {particles.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.size}
            fill="#4a90e2"
            opacity={p.opacity}
          />
        ))}
        {/* Connection lines between nearby particles */}
        {particles.map((p1, i) =>
          particles.slice(i + 1).map((p2, j) => {
            const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
            const maxDist = Math.min(width, height) * 0.15
            if (dist < maxDist) {
              return (
                <line
                  key={`${i}-${j}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#4a90e2"
                  strokeWidth={1}
                  opacity={(1 - dist / maxDist) * 0.15}
                />
              )
            }
            return null
          }),
        )}
      </svg>

      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(74, 144, 226, 0.08) 0%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center text-center"
        style={{ gap }}
      >
        {/* Logo: mark + text (white logos for dark background) */}
        <div className="flex items-center" style={{ gap: gap * 0.4 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt=""
            width={logoMarkSize}
            height={logoMarkSize}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-text.svg"
            alt="Shippy"
            width={logoTextWidth}
            height={logoTextHeight}
          />
        </div>

        {/* Headline - two lines on tall/square cards, one line on wide cards */}
        <h1
          style={{
            fontSize: headlineSize,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            margin: 0,
            whiteSpace: isWide || isVeryWide ? 'nowrap' : 'normal',
          }}
        >
          Build together.
          {isWide || isVeryWide ? null : <br />}
          <span
            style={{
              color: '#4a90e2',
              marginLeft: isWide || isVeryWide ? 12 : 0,
            }}
          >
            Share the upside.
          </span>
        </h1>
      </div>
    </div>
  )
}

// Generate static particle positions for SVG rendering
function generateParticles(
  width: number,
  height: number,
  count: number,
): { x: number; y: number; size: number; opacity: number }[] {
  // Use deterministic "random" based on dimensions for consistent output
  const seed = width * height
  const particles = []
  for (let i = 0; i < count; i++) {
    const pseudoRandom = (n: number) => {
      const x = Math.sin(seed + n * 12.9898) * 43758.5453
      return x - Math.floor(x)
    }
    particles.push({
      x: pseudoRandom(i * 3) * width,
      y: pseudoRandom(i * 3 + 1) * height,
      size: pseudoRandom(i * 3 + 2) * 2 + 1,
      opacity: pseudoRandom(i * 3 + 3) * 0.5 + 0.3,
    })
  }
  return particles
}

function LogoDownload() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold sm:text-2xl">Logo</h2>
      <p className="text-sm text-muted-foreground">
        When combining the mark and text, use <strong>12px</strong> (0.75rem)
        spacing between them. Scale proportionally as needed.
      </p>
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        {/* Light background = dark logos */}
        <div className="flex max-w-72 flex-col gap-3">
          <div className="flex h-32 w-full items-center justify-center gap-3 rounded-lg border bg-white p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark-dark.svg" alt="" width={32} height={32} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-text-dark.svg"
              alt="Shippy"
              width={84}
              height={40}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">
              Light background
            </span>
            <div className="flex gap-2">
              <a href="/logo-mark-dark.svg" download="shippy-mark-dark.svg">
                <Button variant="outline" size="sm" className="cursor-pointer">
                  <Download01 className="size-3.5" />
                  Mark
                </Button>
              </a>
              <a href="/logo-text-dark.svg" download="shippy-text-dark.svg">
                <Button variant="outline" size="sm" className="cursor-pointer">
                  <Download01 className="size-3.5" />
                  Text
                </Button>
              </a>
            </div>
          </div>
        </div>
        {/* Dark background = white logos */}
        <div className="flex max-w-72 flex-col gap-3">
          <div className="flex h-32 w-full items-center justify-center gap-3 rounded-lg border bg-[#1a1a1a] p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="" width={32} height={32} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-text.svg" alt="Shippy" width={84} height={40} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">
              Dark background
            </span>
            <div className="flex gap-2">
              <a href="/logo-mark.svg" download="shippy-mark-white.svg">
                <Button variant="outline" size="sm" className="cursor-pointer">
                  <Download01 className="size-3.5" />
                  Mark
                </Button>
              </a>
              <a href="/logo-text.svg" download="shippy-text-white.svg">
                <Button variant="outline" size="sm" className="cursor-pointer">
                  <Download01 className="size-3.5" />
                  Text
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MediaKitPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={routes.home()}>Company</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Media Kit</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Media Kit
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Download Shippy brand assets for press, social media, and
          presentations.
        </p>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold sm:text-2xl">Mission</h2>
        <p className="text-base text-muted-foreground sm:text-lg">
          The platform where contributors earn recurring royalties for helping
          startups grow. Ship work. Share the upside.
        </p>
      </div>

      <Separator />

      <LogoDownload />

      <Separator />

      <div className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold sm:text-2xl">Social Media</h2>
        <div className="grid gap-8 sm:gap-12">
          {socialAssets.map((size) => (
            <AssetCard key={size.name} {...size} />
          ))}
        </div>
      </div>
    </div>
  )
}
