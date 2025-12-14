// Company routes (legal, media kit, etc.)

// For Next.js app router paths
export const companyPaths = {
  terms: '/legal/terms',
  privacy: '/legal/privacy',
  mediaKit: '/media-kit',
} as const

// For navigation - functions that generate actual URLs
export const companyRoutes = {
  terms: () => '/legal/terms',
  privacy: () => '/legal/privacy',
  mediaKit: () => '/media-kit',
} as const
