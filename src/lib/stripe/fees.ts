/**
 * Stripe fee calculation utilities
 *
 * Fee structure (Uber-style - founder pays all fees):
 * - Contributors receive: Full pool amount
 * - Shippy receives: Platform fee (2% of pool)
 * - Founder pays: Pool + Platform fee + Stripe processing fees
 */

// Stripe's standard pricing for card payments (US)
// https://stripe.com/pricing
const STRIPE_PERCENTAGE = 2.9 // 2.9%
const STRIPE_FIXED_CENTS = 30 // $0.30

/**
 * Calculate Stripe processing fee for a given amount
 *
 * Stripe charges 2.9% + $0.30 per successful card charge (US)
 *
 * To ensure we collect the right amount AFTER Stripe takes their fee,
 * we need to calculate the gross amount that results in the desired net.
 *
 * Formula: grossAmount = (netAmount + fixedFee) / (1 - percentageFee)
 */
export function calculateStripeFee(amountCents: number): {
  /** The Stripe fee in cents */
  feeCents: number
  /** The total to charge (amount + fee) */
  totalCents: number
} {
  // Calculate gross amount needed to net the desired amount after Stripe fees
  const netAmount = amountCents
  const grossAmount = Math.ceil(
    (netAmount + STRIPE_FIXED_CENTS) / (1 - STRIPE_PERCENTAGE / 100),
  )
  const feeCents = grossAmount - netAmount

  return {
    feeCents,
    totalCents: grossAmount,
  }
}

/**
 * Calculate the full breakdown for a founder payout
 *
 * @param poolAmountCents - Amount going to contributors
 * @param platformFeeCents - Shippy's platform fee
 * @returns Full breakdown of what founder pays
 */
export function calculateFounderPayoutTotal(
  poolAmountCents: number,
  platformFeeCents: number,
): {
  /** Amount going to contributors */
  poolAmountCents: number
  /** Shippy's platform fee */
  platformFeeCents: number
  /** Subtotal before Stripe fees (pool + platform) */
  subtotalCents: number
  /** Stripe processing fee */
  stripeFeeCents: number
  /** Total founder pays */
  founderTotalCents: number
} {
  const subtotalCents = poolAmountCents + platformFeeCents
  const { feeCents: stripeFeeCents, totalCents: founderTotalCents } =
    calculateStripeFee(subtotalCents)

  return {
    poolAmountCents,
    platformFeeCents,
    subtotalCents,
    stripeFeeCents,
    founderTotalCents,
  }
}

/**
 * Format cents as a dollar amount string
 */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Format a full payout breakdown for display
 */
export function formatPayoutBreakdown(breakdown: {
  poolAmountCents: number
  platformFeeCents: number
  stripeFeeCents: number
  founderTotalCents: number
}): string {
  return [
    `Pool (to contributors): ${formatCents(breakdown.poolAmountCents)}`,
    `Platform fee (2%): ${formatCents(breakdown.platformFeeCents)}`,
    `Processing fee: ${formatCents(breakdown.stripeFeeCents)}`,
    `─────────────────────`,
    `Total: ${formatCents(breakdown.founderTotalCents)}`,
  ].join('\n')
}
