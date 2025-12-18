import { generateRandomLabelColor, isValidHexColor } from './types'
import { describe, expect, test } from 'vitest'

// ================================
// isValidHexColor Tests
// ================================

describe('isValidHexColor', () => {
  describe('valid colors', () => {
    const validColors = [
      '#000000',
      '#FFFFFF',
      '#ffffff',
      '#FF5500',
      '#ff5500',
      '#123456',
      '#ABCDEF',
      '#abcdef',
      '#AbCdEf', // Mixed case
      '#1a2B3c',
    ]

    test.each(validColors)('accepts valid hex color: %s', (color) => {
      expect(isValidHexColor(color)).toBe(true)
    })
  })

  describe('invalid colors', () => {
    const invalidColors = [
      ['red', 'named color'],
      ['blue', 'named color'],
      ['#FFF', 'too short (3 chars)'],
      ['#FFFFFFF', 'too long (7 chars)'],
      ['000000', 'missing hash'],
      ['#GGGGGG', 'invalid hex chars'],
      ['#12345', '5 chars'],
      ['#1234567', '7 chars'],
      ['', 'empty string'],
      ['#', 'just hash'],
      ['##FFFFFF', 'double hash'],
    ]

    test.each(invalidColors)('rejects invalid hex color: %s', (color) => {
      expect(isValidHexColor(color)).toBe(false)
    })
  })
})

// ================================
// generateRandomLabelColor Tests
// ================================

describe('generateRandomLabelColor', () => {
  test('returns a valid hex color', () => {
    const color = generateRandomLabelColor()
    expect(isValidHexColor(color)).toBe(true)
  })

  test('starts with #', () => {
    const color = generateRandomLabelColor()
    expect(color.startsWith('#')).toBe(true)
  })

  test('has 7 characters total', () => {
    const color = generateRandomLabelColor()
    expect(color).toHaveLength(7)
  })

  test('generates different colors on multiple calls', () => {
    const colors = new Set<string>()
    for (let i = 0; i < 10; i++) {
      colors.add(generateRandomLabelColor())
    }
    // Should have at least 2 different colors in 10 tries (statistically very likely)
    expect(colors.size).toBeGreaterThan(1)
  })

  test('generates lowercase hex', () => {
    const color = generateRandomLabelColor()
    // Our implementation uses lowercase hex chars
    expect(color).toMatch(/^#[0-9a-f]{6}$/)
  })
})
