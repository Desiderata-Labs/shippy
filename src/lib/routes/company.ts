// Company routes (legal, docs, media kit, etc.)

// For Next.js app router paths
export const companyPaths = {
  terms: '/legal/terms',
  privacy: '/legal/privacy',
  mediaKit: '/media-kit',
} as const

export const docsPaths = {
  root: '/docs',
  mcpInstallation: '/docs/mcp-installation',
} as const

// For navigation - functions that generate actual URLs
export const companyRoutes = {
  terms: () => '/legal/terms',
  privacy: () => '/legal/privacy',
  mediaKit: () => '/media-kit',
} as const

export const docsRoutes = {
  root: () => '/docs',
  mcpInstallation: () => '/docs/mcp-installation',
} as const
