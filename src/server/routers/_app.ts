import { bountyRouter } from './bounty'
import { contributorRouter } from './contributor'
import { labelRouter } from './label'
import { mcpTokenRouter } from './mcp-token'
import { notificationRouter } from './notification'
import { payoutRouter } from './payout'
import { projectRouter } from './project'
import { submissionRouter } from './submission'
import { uploadRouter } from './upload'
import { userRouter } from './user'
import { router } from '@/server/trpc'

export const appRouter = router({
  project: projectRouter,
  bounty: bountyRouter,
  label: labelRouter,
  submission: submissionRouter,
  payout: payoutRouter,
  contributor: contributorRouter,
  user: userRouter,
  notification: notificationRouter,
  mcpToken: mcpTokenRouter,
  upload: uploadRouter,
})

export type AppRouter = typeof appRouter
