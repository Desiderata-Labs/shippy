/**
 * NanoID Configuration
 *
 * Uses same alphabet as the PostgreSQL nanoid() function for consistency.
 * Default length: 12 characters (matching the database default)
 *
 * Collision probability with 12-char alphanumeric (62 chars):
 * - 62^12 = ~3.22 × 10^21 possible IDs
 * - At 1000 IDs/second, ~50% collision chance after ~90 million years
 */

/**
 * Alphabet matching the PostgreSQL nanoid() function
 */
export const NANOID_ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Default NanoID length (matches PostgreSQL default)
 */
export const NANOID_LENGTH = 12

/**
 * Regex pattern for validating NanoIDs
 */
export const NANOID_PATTERN = /^[0-9a-zA-Z]{12}$/

/**
 * Check if a string is a valid NanoID
 */
export function isValidNanoId(value: string): boolean {
  return NANOID_PATTERN.test(value)
}

/**
 * Extract the NanoID from a slug format like "my-project-name-abc123XYZ456"
 * The NanoID is always the last segment after splitting by dashes,
 * but since NanoIDs are exactly 12 alphanumeric chars, we validate it.
 *
 * @param slugWithId - A slug that ends with a NanoID (e.g., "my-project-abc123XYZ456")
 * @returns The extracted NanoID, or the original string if no valid NanoID found
 */
export function extractNanoIdFromSlug(slugWithId: string): string {
  // NanoIDs are 12 chars, so check if the last 12 chars are a valid NanoID
  if (slugWithId.length >= 12) {
    const possibleId = slugWithId.slice(-12)
    if (isValidNanoId(possibleId)) {
      return possibleId
    }
  }

  // Fallback: try splitting by dash and checking the last segment
  const segments = slugWithId.split('-')
  const lastSegment = segments[segments.length - 1]
  if (lastSegment && isValidNanoId(lastSegment)) {
    return lastSegment
  }

  // Return original if no valid NanoID found
  return slugWithId
}

/**
 * Create a URL-friendly slug with an embedded NanoID
 * Format: "slugified-name-nanoid" (e.g., "my-project-abc123XYZ456")
 *
 * @param slug - The slugified name (already URL-safe)
 * @param nanoId - The NanoID to append
 * @returns Combined slug with ID
 */
export function createSlugWithId(slug: string, nanoId: string): string {
  if (!slug) {
    return nanoId
  }
  return `${slug}-${nanoId}`
}
