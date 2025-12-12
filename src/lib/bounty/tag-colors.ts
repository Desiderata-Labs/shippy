/**
 * Label color utilities for bounties.
 * Labels use hex colors (like GitHub) instead of predefined palettes.
 */

export interface LabelColorStyle {
  dot: string
  border: string
  text: string
}

/**
 * Get computed label color style from a hex color
 * Returns inline styles for the dot and uses semantic classes for border/text
 */
export function getLabelColor(hexColor: string): LabelColorStyle {
  // Ensure it's a valid hex color, fallback to gray if not
  const isValid = /^#[0-9A-Fa-f]{6}$/.test(hexColor)
  const color = isValid ? hexColor : '#6b7280'

  return {
    dot: color, // Will be used as inline style
    border: 'border-border',
    text: 'text-foreground',
  }
}

/**
 * Get combined classes (border + text, no bg) for badge/pill usage
 */
export function getLabelColorClasses(hexColor: string): string {
  const style = getLabelColor(hexColor)
  return `${style.border} ${style.text}`
}

/**
 * Calculate if text should be light or dark based on background color
 * Uses relative luminance formula
 */
export function shouldUseDarkText(hexColor: string): boolean {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}
