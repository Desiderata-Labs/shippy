/**
 * Unique tag colors for bounty labels.
 * Linear-style: colored dot + border, no background fill.
 * Distinct from primary (points), status colors (green/yellow/red), and other UI elements.
 */
export const TAG_COLORS = {
  GROWTH: {
    dot: 'bg-teal-500',
    border: 'border-border',
    text: 'text-foreground',
  },
  SALES: {
    dot: 'bg-indigo-500',
    border: 'border-border',
    text: 'text-foreground',
  },
  CONTENT: {
    dot: 'bg-violet-500',
    border: 'border-border',
    text: 'text-foreground',
  },
  DESIGN: {
    dot: 'bg-rose-500',
    border: 'border-border',
    text: 'text-foreground',
  },
  DEV: {
    dot: 'bg-amber-500',
    border: 'border-border',
    text: 'text-foreground',
  },
} as const

export type BountyTagKey = keyof typeof TAG_COLORS

export const DEFAULT_TAG_COLOR = {
  dot: 'bg-muted-foreground',
  border: 'border-border',
  text: 'text-foreground',
} as const

/** Get individual color properties for a tag */
export function getTagColor(tag: string) {
  return TAG_COLORS[tag as BountyTagKey] ?? DEFAULT_TAG_COLOR
}

/** Get combined classes (border + text, no bg) for badge/pill usage */
export function getTagColorClasses(tag: string): string {
  const color = getTagColor(tag)
  return `${color.border} ${color.text}`
}
