import { bountyRouter } from './bounty'
import { contributorRouter } from './contributor'
import { payoutRouter } from './payout'
import { projectRouter } from './project'
import { submissionRouter } from './submission'
import { router } from '@/server/trpc'

export const appRouter = router({
  project: projectRouter,
  bounty: bountyRouter,
  submission: submissionRouter,
  payout: payoutRouter,
  contributor: contributorRouter,
})

export type AppRouter = typeof appRouter
