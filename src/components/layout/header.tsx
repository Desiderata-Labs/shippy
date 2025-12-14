'use client'

import { signOut, useSession } from '@/lib/auth/react'
import { LogOut01, Menu01, Plus, Settings01 } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Logo } from '@/components/ui/logo'
import { AppButton } from '../app/app-button'

interface HeaderProps {
  /** Add horizontal padding to the header container (for landing page). */
  padded?: boolean
  /**
   * Header variant:
   * - 'marketing': Sticky header with scroll-based styling (for landing page)
   * - 'app': Static header in the frame area (for app pages)
   */
  variant?: 'marketing' | 'app'
}

/**
 * App header component.
 * In marketing mode: sticky with scroll-based border/background.
 * In app mode: static header in the frame area.
 */
export function Header({ padded = false, variant = 'marketing' }: HeaderProps) {
  const { data: session, isPending } = useSession()
  const [isScrolled, setIsScrolled] = useState(false)

  // Track scroll position to show/hide border (only in marketing mode)
  useEffect(() => {
    if (variant !== 'marketing') return

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0)
    }

    // Check initial scroll position
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [variant])

  // Get user's URLs based on username
  const username = (session?.user as { username?: string })?.username
  const profileUrl = username
    ? routes.user.profile({ username })
    : routes.dashboard.root()
  const newProjectUrl = username
    ? routes.user.newProject({ username })
    : routes.dashboard.root()
  const settingsUrl = username
    ? routes.user.settings({ username })
    : routes.dashboard.root()

  const isApp = variant === 'app'

  return (
    <header
      className={cn(
        'z-50 w-full',
        // Marketing mode: sticky with scroll behavior
        // App mode: static, sits in the frame
        !isApp && 'sticky top-0',
      )}
    >
      {/* Outer wrapper - uses container to match page width */}
      <div
        className={cn(
          'mx-auto max-w-7xl',
          !isApp && 'pt-4',
          padded && 'px-6',
          isApp && 'p-2 sm:p-3',
        )}
      >
        {/* Floating header - styling depends on variant */}
        <div
          className={cn(
            'rounded-xl border transition-all duration-200',
            isApp
              ? // App mode: always transparent, no border
                'border-transparent bg-transparent'
              : // Marketing mode: styling only shows when scrolled
                isScrolled
                ? 'border-border bg-background/80 shadow-lg shadow-black/5 backdrop-blur-md'
                : 'border-transparent bg-transparent shadow-none',
          )}
        >
          {/* Inner content */}
          <div className="flex h-12 items-center px-4">
            {/* Logo */}
            <Link href={routes.home()} className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-mark.svg"
                alt=""
                className="size-6"
                aria-hidden="true"
              />
              <Logo size="sm" className="-translate-y-[2px]" />
            </Link>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Navigation - hidden on mobile */}
            <nav className="hidden items-center space-x-6 text-sm font-medium md:flex">
              <Link
                href={routes.discover.root()}
                className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                Discover
              </Link>
              {session && (
                <>
                  <Link
                    href={routes.dashboard.root()}
                    className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    Dashboard
                  </Link>
                  {username && (
                    <Link
                      href={profileUrl}
                      className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
                    >
                      My Projects
                    </Link>
                  )}
                </>
              )}
            </nav>

            {/* Separator - hidden on mobile */}
            <div className="mx-4 hidden h-8 w-px bg-linear-to-b from-transparent via-white/15 to-transparent md:block" />

            {/* GitHub */}
            <a
              href="https://github.com/Desiderata-Labs/shippy"
              className="text-muted-foreground transition-colors hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
            >
              <svg
                className="size-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
            </a>

            {/* Separator */}
            <div className="mx-4 h-8 w-px bg-linear-to-b from-transparent via-white/15 to-transparent" />

            {/* Auth */}
            <div className="flex items-center space-x-2">
              {isPending ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : session ? (
                <>
                  {username && (
                    <AppButton variant="outline" size="sm" asChild>
                      <Link href={newProjectUrl}>
                        <Plus className="size-4 md:mr-1" />
                        <span className="hidden md:inline">New Project</span>
                      </Link>
                    </AppButton>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <AppButton
                        variant="ghost"
                        className="relative size-8 cursor-pointer rounded-full"
                      >
                        <Avatar className="size-8">
                          <AvatarImage
                            src={session.user.image ?? undefined}
                            alt={session.user.name}
                          />
                          <AvatarFallback className="bg-muted text-xs">
                            {session.user.name
                              ?.split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase() ?? 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </AppButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-56 border-border bg-background/95 backdrop-blur-xl"
                    >
                      <div className="flex items-center justify-start gap-2 p-2">
                        <div className="flex flex-col space-y-1 leading-none">
                          <p className="font-medium">{session.user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.user.email}
                          </p>
                        </div>
                      </div>
                      <DropdownMenuSeparator className="bg-border" />
                      {/* Mobile navigation links */}
                      <div className="md:hidden">
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href={routes.discover.root()}>Discover</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href={routes.dashboard.root()}>Dashboard</Link>
                        </DropdownMenuItem>
                        {username && (
                          <DropdownMenuItem asChild className="cursor-pointer">
                            <Link href={profileUrl}>My Projects</Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator className="bg-border" />
                      </div>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href={settingsUrl}>
                          <Settings01 className="mr-2 size-4" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border" />
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => signOut()}
                      >
                        <LogOut01 className="mr-2 size-4" />
                        Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  {/* Mobile menu for logged-out users */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild className="md:hidden">
                      <AppButton
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer"
                      >
                        <Menu01 className="size-5" />
                      </AppButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48 border-border bg-background/95 backdrop-blur-xl md:hidden"
                    >
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href={routes.discover.root()}>Discover</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border" />
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href={routes.auth.signIn()}>Sign in</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href={routes.auth.signUp()}>Get Started</Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {/* Desktop auth buttons */}
                  <AppButton
                    variant="ghost"
                    size="sm"
                    asChild
                    className="hidden cursor-pointer text-muted-foreground hover:text-foreground md:inline-flex"
                  >
                    <Link href={routes.auth.signIn()}>Sign in</Link>
                  </AppButton>
                  <AppButton
                    size="sm"
                    asChild
                    className="hidden cursor-pointer rounded-lg md:inline-flex"
                  >
                    <Link href={routes.auth.signUp()}>Get Started</Link>
                  </AppButton>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
