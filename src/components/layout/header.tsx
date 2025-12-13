'use client'

import { signOut, useSession } from '@/lib/auth/react'
import { LogOut01, Plus, Settings01 } from '@untitled-ui/icons-react'
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
}

/**
 * App header component.
 * Shows border/background only when page is scrolled.
 */
export function Header({ padded = false }: HeaderProps) {
  const { data: session, isPending } = useSession()
  const [isScrolled, setIsScrolled] = useState(false)

  // Track scroll position to show/hide border
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0)
    }

    // Check initial scroll position
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Outer wrapper - uses container to match page width */}
      <div className={cn('mx-auto max-w-7xl pt-4', padded && 'px-6')}>
        {/* Floating header - styling only shows when scrolled */}
        <div
          className={cn(
            'rounded-xl border transition-all duration-200',
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

            {/* Navigation */}
            <nav className="flex items-center space-x-6 text-sm font-medium">
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
                        <Plus className="mr-1 size-4" />
                        New Project
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
                  <AppButton
                    variant="ghost"
                    size="sm"
                    asChild
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <Link href={routes.auth.signIn()}>Sign in</Link>
                  </AppButton>
                  <AppButton
                    size="sm"
                    asChild
                    className="cursor-pointer rounded-lg"
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
