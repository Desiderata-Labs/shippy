// Settings routes (/settings/...)
// These are user-agnostic routes that redirect based on the logged-in user

export interface SettingsPaymentsParams {
  stripeStatus?: 'return' | 'refresh'
}

// For Next.js app router paths
export const settingsPaths = {
  root: '/settings',
  payments: '/settings/payments',
} as const

// For navigation - functions that generate actual URLs
export const settingsRoutes = {
  root: () => '/settings',
  payments: (params?: SettingsPaymentsParams) => {
    const base = '/settings/payments'
    if (!params?.stripeStatus) return base
    return `${base}?stripeStatus=${params.stripeStatus}`
  },
} as const
