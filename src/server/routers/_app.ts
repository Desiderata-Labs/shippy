import { bountyRouter } from './bounty'
import { contributorRouter } from './contributor'
import { payoutRouter } from './payout'
import { projectRouter } from './project'
import { submissionRouter } from './submission'
import { userRouter } from './user'
import { router } from '@/server/trpc'

export const appRouter = router({
  project: projectRouter,
  bounty: bountyRouter,
  submission: submissionRouter,
  payout: payoutRouter,
  contributor: contributorRouter,
  user: userRouter,
})

export type AppRouter = typeof appRouter
