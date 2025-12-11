'use client'

import { signOut, useSession } from '@/lib/auth/react'
import { LogOut01, Plus, Settings01 } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Logo } from '@/components/ui/logo'

/**
 * Header for app pages (dashboard, discover, project, etc.)
 * Uses container width to match page content.
 */
export function AppHeader() {
  const { data: session, isPending } = useSession()

  // Get user's URLs based on username
  const username = (session?.user as { username?: string })?.username
  const projectsUrl = username
    ? routes.user.projects({ username })
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
      <div className="container px-4 pt-4">
        {/* Clean floating header */}
        <div className="rounded-xl border border-border bg-background/80 shadow-lg shadow-black/5 backdrop-blur-md">
          {/* Inner content */}
          <div className="flex h-12 items-center px-4">
            {/* Logo */}
            <Link href={routes.home()} className="flex items-center">
              <Logo size="md" className="-translate-y-0.5" />
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
                      href={projectsUrl}
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
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="hidden cursor-pointer border-border bg-secondary backdrop-blur-sm transition-colors hover:bg-accent sm:flex"
                    >
                      <Link href={newProjectUrl}>
                        <Plus className="mr-1 size-4" />
                        New Project
                      </Link>
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
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
                      </Button>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <Link href={routes.auth.signIn()}>Sign in</Link>
                  </Button>
                  <Button
                    size="sm"
                    asChild
                    className="cursor-pointer rounded-lg"
                  >
                    <Link href={routes.auth.signUp()}>Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
