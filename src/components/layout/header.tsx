'use client'

import { signOut, useSession } from '@/lib/auth/react'
import {
  Home02,
  LogOut01,
  Plus,
  Settings01,
  User01,
} from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
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

export function Header() {
  const { data: session, isPending } = useSession()

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Outer wrapper for positioning */}
      <div className="mx-auto max-w-6xl px-6 pt-4">
        {/* Clean floating header */}
        <div className="rounded-xl border border-white/10 bg-background/80 shadow-lg shadow-black/5 backdrop-blur-md dark:border-white/10 dark:bg-background/60">
          {/* Inner content */}
          <div className="flex h-12 items-center px-4">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Logo size="md" className="-translate-y-0.5" />
            </Link>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Navigation */}
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <Link
                href="/discover"
                className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                Discover
              </Link>
              {session && (
                <>
                  <Link
                    href="/dashboard"
                    className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/founder"
                    className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    My Projects
                  </Link>
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
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="hidden cursor-pointer border-white/10 bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10 sm:flex dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <Link href="/founder/new">
                      <Plus className="mr-1 size-4" />
                      New Project
                    </Link>
                  </Button>
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
                          <AvatarFallback className="bg-white/10 text-xs">
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
                      className="w-56 border-white/10 bg-background/95 backdrop-blur-xl dark:border-white/10"
                    >
                      <div className="flex items-center justify-start gap-2 p-2">
                        <div className="flex flex-col space-y-1 leading-none">
                          <p className="font-medium">{session.user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.user.email}
                          </p>
                        </div>
                      </div>
                      <DropdownMenuSeparator className="bg-white/8" />
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href="/dashboard">
                          <Home02 className="mr-2 size-4" />
                          Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href="/founder">
                          <User01 className="mr-2 size-4" />
                          My Projects
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href="/settings">
                          <Settings01 className="mr-2 size-4" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/8" />
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
                    <Link href="/sign-in">Sign in</Link>
                  </Button>
                  <Button
                    size="sm"
                    asChild
                    className="cursor-pointer rounded-lg"
                  >
                    <Link href="/sign-up">Get Started</Link>
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
