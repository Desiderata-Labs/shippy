import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/server'
import { routes } from '@/lib/routes'

/**
 * Stripe Connect redirect handler
 *
 * This page handles returns from Stripe Connect onboarding and redirects
 * users to their own settings page with the appropriate status.
 */
export default async function StripeConnectRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ stripeStatus?: string }>
}) {
  const headersList = await headers()
  const session = await auth.api.getSession({ headers: headersList })

  if (!session?.user?.id) {
    redirect(routes.auth.signIn())
  }

  // Get the user's username
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true },
  })

  if (!user?.username) {
    redirect(routes.dashboard.root())
  }

  // Build the redirect URL with stripe status
  const params = await searchParams
  const stripeStatus = params.stripeStatus
  let targetUrl = routes.user.settings({ username: user.username })

  if (stripeStatus === 'return' || stripeStatus === 'refresh') {
    targetUrl += `?stripeStatus=${stripeStatus}`
  }

  redirect(targetUrl)
}
