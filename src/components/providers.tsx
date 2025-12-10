'use client'

import { TRPCProvider } from '@/lib/trpc/react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TRPCProvider>
        {children}
        <Toaster position="bottom-right" richColors />
      </TRPCProvider>
    </ThemeProvider>
  )
}
