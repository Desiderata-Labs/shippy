/**
 * Chart color utilities for visualizations.
 * Uses a palette of distinct, well-spaced hues that work on light/dark backgrounds.
 */

// 12 distinct, well-spaced hues - similar to generateRandomLabelColor but deterministic
export const CHART_COLORS = [
  '#4a90e2', // primary blue
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#c026d3', // fuchsia
  '#ca8a04', // yellow
  '#dc2626', // red
  '#4f46e5', // indigo
  '#059669', // emerald
  '#db2777', // pink
  '#64748b', // slate
] as const

/**
 * Get a color for an item by index.
 * Cycles through the palette, with reduced opacity for overflow.
 *
 * Supports 12 fully distinct colors, then cycles with transparency.
 * Effectively unlimited contributors with graceful degradation.
 */
export function getChartColor(index: number): string {
  const baseIndex = index % CHART_COLORS.length
  const cycle = Math.floor(index / CHART_COLORS.length)

  if (cycle === 0) {
    return CHART_COLORS[baseIndex]
  }

  // For overflow, reduce opacity each cycle
  const opacity = Math.max(0.7 - cycle * 0.15, 0.4)
  return `${CHART_COLORS[baseIndex]}${Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0')}`
}
