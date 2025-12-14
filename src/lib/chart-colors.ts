/**
 * Chart color utilities for visualizations.
 *
 * Colors are generated using consistent 30° hue steps in OKLCH space,
 * starting from our primary blue. This creates smooth, harmonious
 * transitions between adjacent colors regardless of how many there are.
 */

export type OklchColorString = `oklch(${string} ${string} ${string})`

// Primary color from theme: oklch(0.6574 0.135 237.09)
const PRIMARY_HUE = 237
const BASE_LIGHTNESS = 0.65
const BASE_CHROMA = 0.14

// Hue step for smooth analogous transitions (~30° keeps colors harmonious)
const HUE_STEP = 30

/**
 * Get a color for an item by index.
 *
 * Each subsequent index shifts hue by 30° for smooth transitions.
 * Adjacent colors always look good together.
 *
 * @param index - The index of the item (0-based)
 * @returns OKLCH color string
 */
export function getChartColor(index: number): OklchColorString {
  const hue = (PRIMARY_HUE + index * HUE_STEP) % 360

  // Slight lightness variation to add depth (oscillates ±0.05)
  const lightnessOffset = Math.sin(index * 1.2) * 0.05
  const lightness = Math.max(
    0.55,
    Math.min(0.75, BASE_LIGHTNESS + lightnessOffset),
  )

  // Slight chroma variation for visual interest
  const chromaOffset = Math.cos(index * 0.9) * 0.02
  const chroma = Math.max(0.1, Math.min(0.16, BASE_CHROMA + chromaOffset))

  return `oklch(${lightness.toFixed(4)} ${chroma.toFixed(4)} ${hue.toFixed(2)})`
}

/**
 * Get a specific number of chart colors.
 *
 * @param count - Number of colors to generate
 * @returns Array of OKLCH color strings
 */
export function getChartColors(count: number): OklchColorString[] {
  return Array.from({ length: count }, (_, i) => getChartColor(i))
}
