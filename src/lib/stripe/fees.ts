/**
 * Stripe fee calculation utilities
 *
 * Fee structure (Uber-style - founder pays all fees):
 * - Contributors receive: Distributed amount (based on pool utilization)
 * - Shippy receives: Platform fee (2% of full pool amount)
 * - Founder pays: Distributed amount + Platform fee + Stripe processing fees
 *
 * Note: When pool is under-utilized (e.g., 2.5% of points earned),
 * founder only pays for the distributed amount + platform fee, not the full pool.
 */

// Stripe's standard pricing for card payments (US)
// https://stripe.com/pricing
const STRIPE_PERCENTAGE = 2.9 // 2.9%
const STRIPE_FIXED_CENTS = 30 // $0.30

/**
 * Calculate Stripe processing fee FROM a gross amount
 *
 * This calculates what Stripe takes from a given charge amount.
 * Use this when fees come OUT of the charged amount.
 *
 * Formula: fee = grossAmount * 2.9% + $0.30
 */
export function calculateStripeFeeFromGross(grossAmountCents: number): number {
  if (grossAmountCents <= 0) return 0
  return (
    Math.ceil((grossAmountCents * STRIPE_PERCENTAGE) / 100) + STRIPE_FIXED_CENTS
  )
}

/**
 * Calculate Stripe processing fee for a given NET amount
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
 * Format cents as a dollar amount string
 */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
