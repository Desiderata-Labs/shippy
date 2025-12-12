import { deburr } from 'lodash'

export const PROJECT_KEY_LENGTH = 3 as const

/**
 * Normalize a project key:
 * - Remove diacritics
 * - Keep A-Z only
 * - Uppercase
 * - Truncate to 3 characters
 */
export function normalizeProjectKey(input: string): string {
  const raw = (input ?? '').toString()
  const ascii = deburr(raw)
  const lettersOnly = ascii.replace(/[^a-zA-Z]/g, '')
  return lettersOnly.toUpperCase().slice(0, PROJECT_KEY_LENGTH)
}

export function validateProjectKey(input: string): {
  isValid: boolean
  error?: string
} {
  const normalized = normalizeProjectKey(input)
  if (normalized.length !== PROJECT_KEY_LENGTH) {
    return {
      isValid: false,
      error: `Project key must be exactly ${PROJECT_KEY_LENGTH} letters`,
    }
  }
  if (!/^[A-Z]{3}$/.test(normalized)) {
    return {
      isValid: false,
      error: 'Project key must be letters A–Z only',
    }
  }
  return { isValid: true }
}

/**
 * Suggest a 3-letter project key from a project name.
 *
 * Strategy:
 * - 3+ words: Use first letter of each word (e.g., "Earn A Slice" → "EAS")
 * - 1-2 words: Use first 3 letters of combined words (e.g., "Oath" → "OAT", "My App" → "MYA")
 *
 * @example
 * suggestProjectKeyFromName("Oath") // "OAT"
 * suggestProjectKeyFromName("Earn A Slice") // "EAS"
 * suggestProjectKeyFromName("GrowPilot") // "GRO"
 * suggestProjectKeyFromName("My App") // "MYA"
 */
export function suggestProjectKeyFromName(name: string): string {
  const cleanWords = deburr((name ?? '').toString())
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, ''))
    .filter(Boolean)

  if (cleanWords.length === 0) {
    return 'XXX'
  }

  // For 3+ words, use first letter of each (up to 3)
  if (cleanWords.length >= 3) {
    return cleanWords
      .slice(0, PROJECT_KEY_LENGTH)
      .map((w) => w[0]!)
      .join('')
      .toUpperCase()
  }

  // For 1-2 words, use first 3 letters of the combined name
  // This gives "Oath" → "OAT", "GrowPilot" → "GRO", "My App" → "MYA"
  const combined = cleanWords.join('')
  const key = normalizeProjectKey(combined)

  // Rare edge case: very short names like "AI" - pad to 3 chars
  if (key.length < PROJECT_KEY_LENGTH) {
    return (key + 'XXX').slice(0, PROJECT_KEY_LENGTH)
  }

  return key
}
