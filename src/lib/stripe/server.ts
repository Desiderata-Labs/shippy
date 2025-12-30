import { routes } from '@/lib/routes'
import 'server-only'
import Stripe from 'stripe'

// ================================
// Environment Configuration
// ================================

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://shippy.sh'

function getStripeConfig() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable')
  }

  return {
    secretKey,
    webhookSecret: webhookSecret || '',
  }
}

// ================================
// Stripe Client
// ================================

let stripeInstance: Stripe | null = null

/**
 * Get the Stripe client instance (lazy-initialized singleton)
 */
export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const config = getStripeConfig()
    stripeInstance = new Stripe(config.secretKey, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
      appInfo: {
        name: 'Shippy',
        url: APP_URL,
      },
    })
  }
  return stripeInstance
}

/**
 * Get the webhook secret for verifying Stripe webhooks
 */
export function getStripeWebhookSecret(): string {
  const config = getStripeConfig()
  return config.webhookSecret
}

/**
 * Get the app URL for redirect URLs
 */
export function getAppUrl(): string {
  return APP_URL
}

// ================================
// Stripe Connect URLs
// ================================

/**
 * Build the Stripe Connect onboarding return URL
 * This redirects to /settings/payments which then redirects to /u/[username]/settings
 */
export function getConnectReturnUrl(): string {
  return `${APP_URL}${routes.settings.payments({ stripeStatus: 'return' })}`
}

/**
 * Build the Stripe Connect onboarding refresh URL
 * This redirects to /settings/payments which then redirects to /u/[username]/settings
 */
export function getConnectRefreshUrl(): string {
  return `${APP_URL}${routes.settings.payments({ stripeStatus: 'refresh' })}`
}
