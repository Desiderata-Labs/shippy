'use client'

import { signOut, useSession } from '@/lib/auth/react'
import {
  Home02,
  LogOut01,
  PieChart01,
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

export function Header() {
  const { data: session, isPending } = useSession()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-screen-2xl items-center px-4">
        {/* Logo */}
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <PieChart01 className="size-6 text-primary" />
          <span className="hidden font-logo text-base tracking-wide uppercase sm:inline-block">
            Earn A <span className="text-primary">Slice</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex flex-1 items-center space-x-6 text-sm font-medium">
          <Link
            href="/discover"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Discover
          </Link>
          {session && (
            <>
              <Link
                href="/dashboard"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Dashboard
              </Link>
              <Link
                href="/founder"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                My Projects
              </Link>
            </>
          )}
        </nav>

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
                className="hidden sm:flex"
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
                      <AvatarFallback>
                        {session.user.name
                          ?.split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase() ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{session.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.user.email}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
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
                  <DropdownMenuSeparator />
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
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/sign-up">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
