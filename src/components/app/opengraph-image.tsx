import { ImageResponse } from 'next/og'

// Standard OG image dimensions
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

// Truncate text to a specific length while preserving words
function truncateText(text: string, maxLength: number = 250): string {
  if (text.length <= maxLength) return text
  const truncated = text.slice(0, maxLength).split(' ').slice(0, -1).join(' ')
  return `${truncated}...`
}

type OpenGraphImageProps = {
  title: string
  description?: string | null
  /** Optional badge/label shown above the title */
  badge?: string | null
}

// Base URL for assets - use environment variable or fallback
const getBaseUrl = () => {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  return 'http://localhost:3050'
}

// Generate static particle positions for consistent output
function generateParticles(
  width: number,
  height: number,
  count: number,
): { x: number; y: number; size: number; opacity: number }[] {
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
      size: pseudoRandom(i * 3 + 2) * 4 + 2,
      opacity: pseudoRandom(i * 3 + 3) * 0.5 + 0.4,
    })
  }
  return particles
}

export function OpenGraphImage({
  title,
  description,
  badge,
}: OpenGraphImageProps): ImageResponse {
  const baseUrl = getBaseUrl()
  const particles = generateParticles(size.width, size.height, 50)

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        backgroundColor: '#1a1a1a',
        padding: '64px',
        fontFamily: 'system-ui, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Particle dots */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: '#4a90e2',
            opacity: p.opacity,
          }}
        />
      ))}

      {/* Large radial gradient overlay - centered and blending across entire bg */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'radial-gradient(ellipse 120% 100% at 50% 40%, rgba(74, 144, 226, 0.2) 0%, rgba(74, 144, 226, 0.08) 40%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '20px',
          position: 'relative',
          width: '100%',
          flex: 1,
        }}
      >
        {/* Logo - using correct aspect ratios: mark=48x36, text=94x45 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${baseUrl}/logo-mark.svg`} alt="" width={80} height={60} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${baseUrl}/logo-text.svg`}
            alt="Shippy"
            width={160}
            height={77}
          />
        </div>

        {/* Badge (optional) */}
        {badge && (
          <div
            style={{
              display: 'flex',
              padding: '12px 24px',
              backgroundColor: 'rgba(74, 144, 226, 0.3)',
              borderRadius: '9999px',
              fontSize: '24px',
              color: '#6bb3f8',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              marginTop: '24px',
            }}
          >
            {badge}
          </div>
        )}

        {/* Title */}
        <div
          style={{
            fontSize: '64px',
            fontWeight: 700,
            color: 'white',
            lineHeight: 1.1,
            maxWidth: '90%',
            letterSpacing: '-0.02em',
            marginTop: badge ? '8px' : '40px',
          }}
        >
          {truncateText(title, 60)}
        </div>

        {/* Description */}
        {description && (
          <div
            style={{
              fontSize: '42px',
              fontWeight: 400,
              color: '#94a3b8',
              lineHeight: 1.35,
              maxWidth: '90%',
              letterSpacing: '-0.01em',
            }}
          >
            {truncateText(description, 100)}
          </div>
        )}
      </div>
    </div>,
    {
      ...size,
    },
  )
}
