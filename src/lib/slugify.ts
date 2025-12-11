import { deburr, kebabCase, trim } from 'lodash'

/**
 * Default maximum length for slugs
 */
export const DEFAULT_SLUG_MAX_LENGTH = 50

/**
 * Convert a string into a URL-friendly slug
 *
 * Handles:
 * - Diacritics (é → e, ñ → n, etc.)
 * - Spaces and special characters → dashes
 * - Multiple consecutive dashes → single dash
 * - Leading/trailing dashes
 * - Max length truncation
 *
 * @param input - The input string to slugify
 * @param maxLength - Maximum length for the slug (default: 50)
 * @returns A URL-safe slug
 *
 * @example
 * slugify('My Awesome Project') // 'my-awesome-project'
 * slugify('Café & Restaurant') // 'cafe-restaurant'
 * slugify('  Hello   World  ') // 'hello-world'
 */
export function slugify(
  input: string,
  maxLength: number = DEFAULT_SLUG_MAX_LENGTH,
): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  // Convert to lowercase, remove diacritics, and convert to kebab case
  let slug = kebabCase(deburr(input.toLowerCase()))

  // Trim any leading or trailing dashes
  slug = trim(slug, '-')

  // Truncate to max length
  if (slug.length > maxLength) {
    slug = slug.substring(0, maxLength)
    // Ensure we don't end with a dash after truncation
    slug = trim(slug, '-')
  }

  return slug
}
