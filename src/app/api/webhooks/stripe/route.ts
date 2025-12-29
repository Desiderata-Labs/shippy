import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/server'
import { getStripeClient, getStripeWebhookSecret } from '@/lib/stripe/server'
import { handleWebhook } from '@/server/services/stripe'

/**
 * Stripe Webhook Handler
 *
 * Handles Stripe webhook events for:
 * - account.updated: Sync Stripe Connect account status
 * - checkout.session.completed: Mark payout as paid when founder completes checkout
 *
 * Webhook URL: https://shippy.sh/api/webhooks/stripe
 *
 * Setup in Stripe Dashboard:
 * 1. Go to Developers > Webhooks
 * 2. Add endpoint: https://shippy.sh/api/webhooks/stripe
 * 3. Select events: account.updated, checkout.session.completed
 * 4. Copy the signing secret to STRIPE_WEBHOOK_SECRET env var
 */
export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 },
    )
  }

  const webhookSecret = getStripeWebhookSecret()
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 },
    )
  }

  let event
  try {
    const stripe = getStripeClient()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Webhook signature verification failed: ${message}`)
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 },
    )
  }

  // Handle the event
  const result = await handleWebhook({ prisma, event })

  if (!result.success) {
    console.error(`Webhook handler error: ${result.message}`)
    // Return 200 to acknowledge receipt even on handler error
    // Stripe will retry if we return 4xx/5xx
    return NextResponse.json({
      received: true,
      error: result.message,
    })
  }

  return NextResponse.json({
    received: true,
    handled: result.handled,
    type: result.eventType,
  })
}
