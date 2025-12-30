import { NextRequest, NextResponse } from 'next/server'
import { paths, routes } from '@/lib/routes'

/**
 * Routes that require authentication
 * Note: User profile routes will be under /u/[username] when added
 */
const protectedRoutes = [
  paths.dashboard.root,
  paths.settings.payments, // Stripe Connect redirect handler
]

/**
 * Route patterns that require authentication (regex patterns)
 * Used for dynamic routes that can't be matched with simple prefix
 */
const protectedPatterns = [
  /^\/p\/[^/]+\/integrations/, // Project integrations (founder only, checked in tRPC)
  /^\/u\/[^/]+\/settings/, // User settings (Stripe Connect, MCP tokens, etc.)
]

/**
 * Routes that should redirect to dashboard if already authenticated
 */
const authRoutePaths = [paths.auth.signIn, paths.auth.signUp]

/**
 * Check if a path matches any of the routes (prefix match)
 */
function matchesRoute(path: string, routesList: string[]): boolean {
  return routesList.some(
    (route) => path === route || path.startsWith(`${route}/`),
  )
}

/**
 * Check if a path matches any of the regex patterns
 */
function matchesPattern(path: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(path))
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Get the session cookie (BetterAuth uses 'eas.session_token' with prefix)
  const sessionCookie =
    request.cookies.get('eas.session_token') ||
    request.cookies.get('eas.session_token.0') || // Chunked cookie support
    request.cookies.get('__Secure-eas.session_token') // Secure cookie in prod

  const isAuthenticated = !!sessionCookie?.value

  // If user is on auth routes and is authenticated, redirect to dashboard
  if (isAuthenticated && matchesRoute(pathname, authRoutePaths)) {
    return NextResponse.redirect(new URL(routes.dashboard.root(), request.url))
  }

  // If user is on protected routes and is not authenticated, redirect to sign-in
  if (
    !isAuthenticated &&
    (matchesRoute(pathname, protectedRoutes) ||
      matchesPattern(pathname, protectedPatterns))
  ) {
    const signInUrl = new URL(routes.auth.signIn(), request.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     * - opengraph-image routes (generated OG images)
     * - twitter-image routes (generated Twitter images)
     */
    '/((?!_next/static|_next/image|api/|favicon.ico|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
