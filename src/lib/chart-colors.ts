/**
 * Chart color utilities for visualizations.
 * Generates a harmonious palette using OKLCH color space.
 *
 * Colors are generated starting from the primary hue and rotating
 * by the golden angle (≈137.5°) which provides optimal visual distinction
 * while maintaining harmonic relationships.
 */

// Primary color from theme: oklch(0.6574 0.135 237.09)
const PRIMARY_HUE = 237.09
const BASE_LIGHTNESS = 0.6574
const BASE_CHROMA = 0.135

// Golden angle for optimal color distribution
const GOLDEN_ANGLE = 137.5077640500378

/**
 * Get a color for an item by index.
 *
 * Uses golden angle rotation from the primary hue to generate
 * visually distinct but harmonious colors.
 *
 * @param index - The index of the item (0-based)
 * @returns OKLCH color string
 */
export function getChartColor(index: number): string {
  // Rotate hue by golden angle for each index
  // This ensures maximum visual distinction between adjacent colors
  const hue = (PRIMARY_HUE + index * GOLDEN_ANGLE) % 360

  // Vary lightness slightly to add depth (oscillate between 0.58-0.72)
  const lightnessOffset = Math.sin(index * 0.8) * 0.07
  const lightness = Math.max(0.5, Math.min(0.75, BASE_LIGHTNESS + lightnessOffset))

  // Keep chroma consistent but slightly reduce for very high indices
  // to avoid overly saturated colors
  const chroma = index < 12 ? BASE_CHROMA : BASE_CHROMA * 0.9

  return `oklch(${lightness.toFixed(4)} ${chroma.toFixed(4)} ${hue.toFixed(2)})`
}

/**
 * Get a specific number of chart colors.
 * Useful for generating a palette upfront.
 *
 * @param count - Number of colors to generate
 * @returns Array of OKLCH color strings
 */
export function getChartColors(count: number): string[] {
  return Array.from({ length: count }, (_, i) => getChartColor(i))
}
