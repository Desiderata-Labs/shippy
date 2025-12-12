import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Logo({ className, size = 'md' }: LogoProps) {
  const sizeConfig = {
    sm: { width: 63, height: 30 },
    md: { width: 84, height: 40 },
    lg: { width: 94, height: 45 },
  }

  const { width, height } = sizeConfig[size]

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-text.svg"
      alt="Shippy"
      width={width}
      height={height}
      className={cn('dark:brightness-100 dark:invert-0', className)}
      aria-label="Shippy"
    />
  )
}
