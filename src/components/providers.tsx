'use client'

import { TRPCProvider } from '@/lib/trpc/react'
import PlausibleProvider from 'next-plausible'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PlausibleProvider domain="shippy.sh">
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        forcedTheme="dark"
        disableTransitionOnChange
      >
        <TRPCProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </TRPCProvider>
      </ThemeProvider>
    </PlausibleProvider>
  )
}
