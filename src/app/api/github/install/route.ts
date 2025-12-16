import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/server'
import { routes } from '@/lib/routes'

/**
 * Redirects the user to GitHub to install the Shippy GitHub App
 * Query param: ?projectId=xxx
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    return NextResponse.redirect(new URL(routes.auth.signIn(), request.url))
  }

  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json(
      { error: 'Missing projectId parameter' },
      { status: 400 },
    )
  }

  const appSlug = process.env.GITHUB_APP_SLUG
  if (!appSlug) {
    return NextResponse.json(
      { error: 'GitHub App not configured' },
      { status: 500 },
    )
  }

  // State parameter to pass project ID through the OAuth flow
  const state = Buffer.from(
    JSON.stringify({ projectId, userId: session.user.id }),
  ).toString('base64url')

  // Redirect to GitHub App installation page
  const installUrl = new URL(
    `https://github.com/apps/${appSlug}/installations/new`,
  )
  installUrl.searchParams.set('state', state)

  return NextResponse.redirect(installUrl)
}
