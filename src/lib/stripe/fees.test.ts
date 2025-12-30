import {
  calculateAchFee,
  calculateAchFeeForNet,
  calculateCardFee,
  calculateCardFeeFromGross,
  calculateExpectedFeeFromGross,
  formatCents,
  getEstimatedFee,
  getPaymentMethodsForAmount,
  isAchAvailable,
  isAchRequired,
} from './fees'
import { describe, expect, test } from 'vitest'

describe('calculateCardFeeFromGross', () => {
  test('calculates card fee for $10 gross', () => {
    const fee = calculateCardFeeFromGross(1000) // $10 gross

    // Card fee: ceil($10 * 2.9%) + $0.30 = ceil(29) + 30 = 59 cents
    expect(fee).toBe(59)
  })

  test('calculates card fee for $100 gross', () => {
    const fee = calculateCardFeeFromGross(10000) // $100 gross

    // Card fee: ceil($100 * 2.9%) + $0.30 = ceil(290) + 30 = 320 cents
    expect(fee).toBe(320)
  })

  test('calculates card fee for $1,000 gross', () => {
    const fee = calculateCardFeeFromGross(100000) // $1,000 gross

    // Card fee: ceil($1,000 * 2.9%) + $0.30 = ceil(2900) + 30 = 2930 cents
    expect(fee).toBe(2930)
  })

  test('returns 0 for zero amount', () => {
    expect(calculateCardFeeFromGross(0)).toBe(0)
  })

  test('returns 0 for negative amount', () => {
    expect(calculateCardFeeFromGross(-100)).toBe(0)
  })
})

describe('calculateCardFee', () => {
  test('calculates card fee for $10 net', () => {
    const result = calculateCardFee(1000) // $10

    // For $10 net, we need to charge enough that after 2.9% + $0.30, we get $10
    // grossAmount = (1000 + 30) / (1 - 0.029) = 1030 / 0.971 ≈ 1061
    // Stripe takes: 1061 * 0.029 + 30 = 30.77 + 30 = 60.77 ≈ 61
    // Net: 1061 - 61 = 1000 ✓
    expect(result.feeCents).toBeGreaterThan(0)
    expect(result.totalCents).toBeGreaterThan(1000)
    // Verify: net after Stripe fee ≈ original amount
    const stripeWouldTake = Math.floor(result.totalCents * 0.029) + 30
    expect(result.totalCents - stripeWouldTake).toBeGreaterThanOrEqual(1000)
  })

  test('calculates fee for $100 charge', () => {
    const result = calculateCardFee(10000) // $100

    expect(result.feeCents).toBeGreaterThan(0)
    expect(result.totalCents).toBeGreaterThan(10000)
  })

  test('calculates fee for $1,000 charge', () => {
    const result = calculateCardFee(100000) // $1,000

    // For $1,000 net, we need gross = (1000 + 0.30) / 0.971 ≈ $1,030.18
    // Fee ≈ $30.18 = 3018 cents
    expect(result.feeCents).toBeGreaterThan(3000) // Around $30
    expect(result.feeCents).toBeLessThan(3500) // But reasonable
    expect(result.totalCents).toBe(100000 + result.feeCents)
  })

  test('handles small amounts', () => {
    const result = calculateCardFee(100) // $1

    // For $1, the $0.30 fixed fee is significant
    expect(result.feeCents).toBeGreaterThan(30)
    expect(result.totalCents).toBeGreaterThan(130)
  })
})

describe('formatCents', () => {
  test('formats whole dollars', () => {
    expect(formatCents(100)).toBe('$1.00')
    expect(formatCents(1000)).toBe('$10.00')
    expect(formatCents(100000)).toBe('$1000.00')
  })

  test('formats cents', () => {
    expect(formatCents(150)).toBe('$1.50')
    expect(formatCents(1234)).toBe('$12.34')
  })

  test('formats zero', () => {
    expect(formatCents(0)).toBe('$0.00')
  })
})

// ================================
// ACH Fee Tests
// ================================

describe('calculateAchFee', () => {
  test('calculates 0.8% fee for small amounts', () => {
    // $100 = 10000 cents -> 0.8% = 80 cents
    expect(calculateAchFee(10000)).toBe(80)
  })

  test('calculates 0.8% fee for medium amounts', () => {
    // $500 = 50000 cents -> 0.8% = 400 cents
    expect(calculateAchFee(50000)).toBe(400)
  })

  test('caps fee at $5 for large amounts', () => {
    // $1000 = 100000 cents -> 0.8% = 800 cents, but capped at 500
    expect(calculateAchFee(100000)).toBe(500)

    // $10000 = 1000000 cents -> 0.8% = 8000 cents, but capped at 500
    expect(calculateAchFee(1000000)).toBe(500)
  })

  test('returns 0 for zero or negative amounts', () => {
    expect(calculateAchFee(0)).toBe(0)
    expect(calculateAchFee(-100)).toBe(0)
  })
})

describe('calculateAchFeeForNet', () => {
  test('calculates gross for small net amount', () => {
    // $100 net, need to cover 0.8% fee
    const result = calculateAchFeeForNet(10000)
    expect(result.feeCents).toBeGreaterThan(0)
    expect(result.totalCents).toBeGreaterThan(10000)
    // Verify: net after fee ≈ original amount
    const achWouldTake = Math.ceil(result.totalCents * 0.008)
    expect(result.totalCents - achWouldTake).toBeGreaterThanOrEqual(10000)
  })

  test('uses $5 cap for large amounts', () => {
    // $1000 net, 0.8% would be $8, but capped at $5
    const result = calculateAchFeeForNet(100000)
    expect(result.feeCents).toBe(500) // $5 cap
    expect(result.totalCents).toBe(100500) // $1000 + $5
  })

  test('returns zero for zero amount', () => {
    const result = calculateAchFeeForNet(0)
    expect(result.feeCents).toBe(0)
    expect(result.totalCents).toBe(0)
  })
})

// ================================
// Payment Method Selection Tests
// ================================

describe('getPaymentMethodsForAmount', () => {
  test('returns card only for amounts under $500', () => {
    expect(getPaymentMethodsForAmount(10000)).toEqual(['card']) // $100
    expect(getPaymentMethodsForAmount(49999)).toEqual(['card']) // $499.99
  })

  test('returns ACH and card for amounts $500-$2000', () => {
    expect(getPaymentMethodsForAmount(50000)).toEqual([
      'us_bank_account',
      'card',
    ]) // $500
    expect(getPaymentMethodsForAmount(100000)).toEqual([
      'us_bank_account',
      'card',
    ]) // $1000
    expect(getPaymentMethodsForAmount(199999)).toEqual([
      'us_bank_account',
      'card',
    ]) // $1999.99
  })

  test('returns ACH only for amounts over $2000', () => {
    expect(getPaymentMethodsForAmount(200000)).toEqual(['us_bank_account']) // $2000
    expect(getPaymentMethodsForAmount(500000)).toEqual(['us_bank_account']) // $5000
  })
})

describe('isAchRequired', () => {
  test('returns false for amounts under $2000', () => {
    expect(isAchRequired(10000)).toBe(false)
    expect(isAchRequired(199999)).toBe(false)
  })

  test('returns true for amounts $2000 and over', () => {
    expect(isAchRequired(200000)).toBe(true)
    expect(isAchRequired(500000)).toBe(true)
  })
})

describe('isAchAvailable', () => {
  test('returns false for amounts under $500', () => {
    expect(isAchAvailable(10000)).toBe(false)
    expect(isAchAvailable(49999)).toBe(false)
  })

  test('returns true for amounts $500 and over', () => {
    expect(isAchAvailable(50000)).toBe(true)
    expect(isAchAvailable(200000)).toBe(true)
  })
})

describe('getEstimatedFee', () => {
  test('returns card fee for card payment method', () => {
    const result = getEstimatedFee(10000, 'card') // $100
    // Card fee for $100 net: gross = (10000 + 30) / 0.971 ≈ 10330
    // Fee ≈ 330 cents = $3.30
    expect(result.feeCents).toBeGreaterThan(300)
    expect(result.feeCents).toBeLessThan(400)
  })

  test('returns ACH fee for us_bank_account payment method', () => {
    const result = getEstimatedFee(10000, 'us_bank_account') // $100
    // ACH fee for $100 net: 0.8% = 80 cents, so gross ≈ 10081
    expect(result.feeCents).toBeGreaterThan(70)
    expect(result.feeCents).toBeLessThan(100)
  })

  test('ACH is cheaper than card for large amounts', () => {
    const cardFee = getEstimatedFee(100000, 'card') // $1000
    const achFee = getEstimatedFee(100000, 'us_bank_account') // $1000

    // Card: ~$29.30, ACH: $5 (capped)
    expect(achFee.feeCents).toBeLessThan(cardFee.feeCents)
    expect(achFee.feeCents).toBe(500) // $5 cap
  })
})

describe('calculateExpectedFeeFromGross', () => {
  test('uses card fee for small amounts (< $500)', () => {
    // $100 charge - card only threshold
    const fee = calculateExpectedFeeFromGross(10000)

    // Card fee: ceil($100 * 2.9%) + $0.30 = 290 + 30 = 320 cents
    expect(fee).toBe(320)
  })

  test('uses ACH fee for medium amounts (>= $500)', () => {
    // $500 charge - ACH available threshold
    const fee = calculateExpectedFeeFromGross(50000)

    // ACH fee: 0.8% of $500 = $4.00 = 400 cents
    expect(fee).toBe(400)
  })

  test('uses ACH fee for large amounts (>= $2000)', () => {
    // $2000 charge - ACH required threshold
    const fee = calculateExpectedFeeFromGross(200000)

    // ACH fee: 0.8% of $2000 = $16, capped at $5 = 500 cents
    expect(fee).toBe(500)
  })

  test('uses ACH fee cap for very large amounts ($10,000)', () => {
    // $10,000 charge - like the screenshot example
    const fee = calculateExpectedFeeFromGross(1000000)

    // ACH fee: 0.8% of $10,000 = $80, capped at $5 = 500 cents
    expect(fee).toBe(500)
  })

  test('returns 0 for zero amount', () => {
    expect(calculateExpectedFeeFromGross(0)).toBe(0)
  })
})
