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
  llmsTxt: '/docs/llms-txt',
} as const

export const llmsTxtPaths = {
  root: '/llms.txt',
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
  llmsTxt: () => '/docs/llms-txt',
} as const

export const llmsTxtRoutes = {
  root: () => '/llms.txt',
  doc: (docPath: string) => `/llms.txt/docs/${docPath}.md`,
} as const
