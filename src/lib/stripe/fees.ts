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

// ================================
// Payment Method Types
// ================================

export type PaymentMethodType = 'card' | 'us_bank_account'

// ================================
// Card Fees (Credit/Debit)
// ================================

// Stripe's standard pricing for card payments (US)
// https://stripe.com/pricing
const STRIPE_CARD_PERCENTAGE = 2.9 // 2.9%
const STRIPE_CARD_FIXED_CENTS = 30 // $0.30

// ================================
// ACH Fees (US Bank Account)
// ================================

// Stripe's ACH Direct Debit pricing (US)
// https://stripe.com/docs/payments/ach-debit
const STRIPE_ACH_PERCENTAGE = 0.8 // 0.8%
const STRIPE_ACH_MAX_CENTS = 500 // $5.00 cap

// ================================
// Card Fee Calculations
// ================================

/**
 * Calculate card processing fee FROM a gross amount
 *
 * This calculates what Stripe takes from a given card charge amount.
 * Use this when fees come OUT of the charged amount.
 *
 * Formula: fee = grossAmount * 2.9% + $0.30
 */
export function calculateCardFeeFromGross(grossAmountCents: number): number {
  if (grossAmountCents <= 0) return 0
  return (
    Math.ceil((grossAmountCents * STRIPE_CARD_PERCENTAGE) / 100) +
    STRIPE_CARD_FIXED_CENTS
  )
}

/**
 * Calculate card processing fee for a given NET amount
 *
 * Stripe charges 2.9% + $0.30 per successful card charge (US)
 *
 * To ensure we collect the right amount AFTER Stripe takes their fee,
 * we need to calculate the gross amount that results in the desired net.
 *
 * Formula: grossAmount = (netAmount + fixedFee) / (1 - percentageFee)
 */
export function calculateCardFee(amountCents: number): {
  /** The Stripe fee in cents */
  feeCents: number
  /** The total to charge (amount + fee) */
  totalCents: number
} {
  // Calculate gross amount needed to net the desired amount after Stripe fees
  const netAmount = amountCents
  const grossAmount = Math.ceil(
    (netAmount + STRIPE_CARD_FIXED_CENTS) / (1 - STRIPE_CARD_PERCENTAGE / 100),
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

// ================================
// ACH Fee Calculations
// ================================

/**
 * Calculate ACH processing fee for a given amount
 *
 * ACH fees are 0.8% with a $5 cap
 */
export function calculateAchFee(amountCents: number): number {
  if (amountCents <= 0) return 0
  const fee = Math.ceil((amountCents * STRIPE_ACH_PERCENTAGE) / 100)
  return Math.min(fee, STRIPE_ACH_MAX_CENTS)
}

/**
 * Calculate ACH processing fee for a NET amount (what we want to receive)
 *
 * Returns the fee and total to charge
 */
export function calculateAchFeeForNet(amountCents: number): {
  feeCents: number
  totalCents: number
} {
  if (amountCents <= 0) return { feeCents: 0, totalCents: 0 }

  // For ACH, we need: total * (1 - 0.008) >= net, but capped at $5
  // If uncapped fee would be > $5, just add $5
  const uncappedGross = Math.ceil(
    amountCents / (1 - STRIPE_ACH_PERCENTAGE / 100),
  )
  const uncappedFee = uncappedGross - amountCents

  if (uncappedFee >= STRIPE_ACH_MAX_CENTS) {
    // Fee is capped, so just add $5
    return {
      feeCents: STRIPE_ACH_MAX_CENTS,
      totalCents: amountCents + STRIPE_ACH_MAX_CENTS,
    }
  }

  return {
    feeCents: uncappedFee,
    totalCents: uncappedGross,
  }
}

// ================================
// Payment Method Selection
// ================================

/**
 * Thresholds for tiered payment method selection (in cents)
 *
 * Based on fraud prevention strategy:
 * - < $500: Card only (3DS liability shift protects us)
 * - $500 - $2,000: ACH preferred, card allowed
 * - > $2,000: ACH only (lower fraud, worth the friction)
 */
const PAYMENT_METHOD_THRESHOLDS = {
  CARD_ONLY_MAX_CENTS: 50000, // $500
  ACH_REQUIRED_MIN_CENTS: 200000, // $2,000
}

/**
 * Get allowed payment methods based on payout amount
 *
 * This implements the tiered payment method strategy for fraud prevention:
 * - Small payouts (<$500): Card with 3DS (liability shifts to issuer)
 * - Medium payouts ($500-$2000): ACH preferred, card allowed
 * - Large payouts (>$2000): ACH only (lower fraud risk)
 */
export function getPaymentMethodsForAmount(
  amountCents: number,
): PaymentMethodType[] {
  if (amountCents < PAYMENT_METHOD_THRESHOLDS.CARD_ONLY_MAX_CENTS) {
    // Small amounts: Card only (3DS provides liability shift)
    return ['card']
  } else if (amountCents < PAYMENT_METHOD_THRESHOLDS.ACH_REQUIRED_MIN_CENTS) {
    // Medium amounts: ACH preferred (listed first), card allowed
    return ['us_bank_account', 'card']
  } else {
    // Large amounts: ACH only (lower fraud risk)
    return ['us_bank_account']
  }
}

/**
 * Get the estimated fee for a given payment method and amount
 */
export function getEstimatedFee(
  amountCents: number,
  paymentMethod: PaymentMethodType,
): { feeCents: number; totalCents: number } {
  if (paymentMethod === 'us_bank_account') {
    return calculateAchFeeForNet(amountCents)
  }
  return calculateCardFee(amountCents)
}

/**
 * Check if ACH is required for this amount (no card option)
 */
export function isAchRequired(amountCents: number): boolean {
  return amountCents >= PAYMENT_METHOD_THRESHOLDS.ACH_REQUIRED_MIN_CENTS
}

/**
 * Check if ACH is available for this amount
 */
export function isAchAvailable(amountCents: number): boolean {
  return amountCents >= PAYMENT_METHOD_THRESHOLDS.CARD_ONLY_MAX_CENTS
}

/**
 * Calculate the expected processing fee based on the likely payment method.
 *
 * Uses the primary (first) payment method from getPaymentMethodsForAmount():
 * - < $500: Card fee (2.9% + $0.30)
 * - >= $500: ACH fee (0.8% capped at $5)
 *
 * This provides a more accurate fee estimate for payout calculations.
 */
export function calculateExpectedFeeFromGross(
  grossAmountCents: number,
): number {
  if (grossAmountCents <= 0) return 0

  const paymentMethods = getPaymentMethodsForAmount(grossAmountCents)
  const primaryMethod = paymentMethods[0]

  if (primaryMethod === 'us_bank_account') {
    return calculateAchFee(grossAmountCents)
  }

  return calculateCardFeeFromGross(grossAmountCents)
}
