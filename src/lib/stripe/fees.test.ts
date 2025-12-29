import {
  calculateFounderPayoutTotal,
  calculateStripeFee,
  formatCents,
} from './fees'
import { describe, expect, test } from 'vitest'

describe('calculateStripeFee', () => {
  test('calculates fee for $10 charge', () => {
    const result = calculateStripeFee(1000) // $10

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
    const result = calculateStripeFee(10000) // $100

    expect(result.feeCents).toBeGreaterThan(0)
    expect(result.totalCents).toBeGreaterThan(10000)
  })

  test('calculates fee for $1,000 charge', () => {
    const result = calculateStripeFee(100000) // $1,000

    // For $1,000 net, we need gross = (1000 + 0.30) / 0.971 ≈ $1,030.18
    // Fee ≈ $30.18 = 3018 cents
    expect(result.feeCents).toBeGreaterThan(3000) // Around $30
    expect(result.feeCents).toBeLessThan(3500) // But reasonable
    expect(result.totalCents).toBe(100000 + result.feeCents)
  })

  test('handles small amounts', () => {
    const result = calculateStripeFee(100) // $1

    // For $1, the $0.30 fixed fee is significant
    expect(result.feeCents).toBeGreaterThan(30)
    expect(result.totalCents).toBeGreaterThan(130)
  })
})

describe('calculateFounderPayoutTotal', () => {
  test('calculates full breakdown for typical payout', () => {
    // $1,000 pool, $20 platform fee (2%)
    const result = calculateFounderPayoutTotal(100000, 2000)

    expect(result.poolAmountCents).toBe(100000)
    expect(result.platformFeeCents).toBe(2000)
    expect(result.subtotalCents).toBe(102000)
    expect(result.stripeFeeCents).toBeGreaterThan(0)
    expect(result.founderTotalCents).toBe(
      result.subtotalCents + result.stripeFeeCents,
    )
  })

  test('contributors get full pool amount', () => {
    const result = calculateFounderPayoutTotal(50000, 1000)

    // Pool amount should be unchanged
    expect(result.poolAmountCents).toBe(50000)
  })

  test('Shippy gets full platform fee', () => {
    const result = calculateFounderPayoutTotal(50000, 1000)

    // Platform fee should be unchanged
    expect(result.platformFeeCents).toBe(1000)
  })

  test('founder pays all fees', () => {
    const result = calculateFounderPayoutTotal(100000, 2000)

    // Founder total = pool + platform + stripe
    expect(result.founderTotalCents).toBeGreaterThan(102000)
    expect(result.founderTotalCents - 102000).toBe(result.stripeFeeCents)
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
