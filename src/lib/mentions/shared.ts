/**
 * Shared utilities for @mentions
 */

/**
 * Regex to match @mentions in text
 * Matches @username where username is alphanumeric with underscores/hyphens
 * Must be at start of string or preceded by whitespace
 */
export const MENTION_REGEX = /(?:^|[\s])@([a-zA-Z0-9_-]+)/g

/**
 * Parse @mentions from content and return unique usernames
 */
export function parseMentions(content: string): string[] {
  const mentions = new Set<string>()
  let match: RegExpExecArray | null

  // Reset regex state
  MENTION_REGEX.lastIndex = 0

  while ((match = MENTION_REGEX.exec(content)) !== null) {
    // Normalize to lowercase for case-insensitive matching
    mentions.add(match[1].toLowerCase())
  }

  return Array.from(mentions)
}

/**
 * Check if content contains any @mentions
 */
export function hasMentions(content: string): boolean {
  MENTION_REGEX.lastIndex = 0
  return MENTION_REGEX.test(content)
}
