import { headers } from 'next/headers'
import type { AppRouter } from '@/server/routers/_app'
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import 'server-only'
import superjson from 'superjson'

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3050'
}

export const serverTrpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      headers: async () => {
        const headersList = await headers()
        return {
          cookie: headersList.get('cookie') ?? '',
        }
      },
    }),
  ],
})
