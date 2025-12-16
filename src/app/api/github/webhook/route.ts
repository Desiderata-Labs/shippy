import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/server'
import {
  BountyStatus,
  ClaimStatus,
  NotificationReferenceType,
  NotificationType,
  SubmissionStatus,
} from '@/lib/db/types'
import {
  BountyInfo,
  formatBountyLinkComment,
  getInstallationOctokit,
  parseBountyReferences,
  verifyWebhookSignature,
} from '@/lib/github/server'
import { routes } from '@/lib/routes'
import { createNotifications } from '@/server/routers/notification'
import {
  claimBounty,
  createBounty,
  releaseClaim,
} from '@/server/services/bounty'
import {
  approveSubmission,
  createSubmission,
} from '@/server/services/submission'
import { Octokit } from '@octokit/rest'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://shippy.sh'

// ================================
// Types
// ================================

interface PullRequestPayload {
  action: string
  number: number
  pull_request: {
    id: number
    node_id: string
    number: number
    title: string
    body: string | null
    html_url: string
    merged: boolean
    merged_at: string | null
    user: {
      id: number
      login: string
    }
  }
  repository: {
    id: number
    full_name: string
  }
  installation?: {
    id: number
  }
}

interface IssueCommentPayload {
  action: string
  comment: {
    id: number
    body: string
    user: {
      id: number
      login: string
    }
  }
  issue: {
    number: number
    node_id: string
    title: string
    body: string | null
    html_url: string
    pull_request?: {
      url: string
    }
  }
  repository: {
    id: number
    full_name: string
    owner: {
      login: string
    }
    name: string
  }
  installation?: {
    id: number
  }
}

// Connection with project info (reused across handlers)
type GitHubConnectionWithProject = NonNullable<
  Awaited<ReturnType<typeof findConnectionForRepo>>
>

// Context passed to command handlers
interface CommandContext {
  octokit: Octokit
  connection: GitHubConnectionWithProject
  owner: string
  repo: string
  issueNumber: number
  commentUserLogin: string
  commentUserId: number
}

// ================================
// Common Helpers
// ================================

/**
 * Find the GitHub connection for a repository
 */
async function findConnectionForRepo(repoId: number, installationId: number) {
  return prisma.gitHubConnection.findFirst({
    where: {
      repoId,
      installationId,
    },
    include: {
      project: {
        include: {
          founder: true,
        },
      },
    },
  })
}

/**
 * Find a Shippy user account by their GitHub user ID
 */
async function findShippyAccountByGitHubId(githubUserId: number) {
  return prisma.account.findFirst({
    where: {
      providerId: 'github',
      accountId: String(githubUserId),
    },
  })
}

/**
 * Post a comment on an issue or PR
 */
async function postComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
) {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  })
}

/**
 * Find a bounty by project and bounty number
 */
async function findBountyByNumber(projectId: string, bountyNumber: number) {
  return prisma.bounty.findFirst({
    where: {
      projectId,
      number: bountyNumber,
    },
  })
}

/**
 * Build command context from payload
 */
async function buildCommandContext(
  payload: IssueCommentPayload,
): Promise<CommandContext | null> {
  const { comment, issue, repository, installation } = payload

  if (!installation) return null

  const connection = await findConnectionForRepo(repository.id, installation.id)
  if (!connection) return null

  const octokit = await getInstallationOctokit(installation.id)
  const [owner, repo] = connection.repoFullName.split('/')

  return {
    octokit,
    connection,
    owner,
    repo,
    issueNumber: issue.number,
    commentUserLogin: comment.user.login,
    commentUserId: comment.user.id,
  }
}

// ================================
// Webhook Handler
// ================================

export async function POST(request: NextRequest) {
  // Get the raw body for signature verification
  const payload = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  const event = request.headers.get('x-github-event')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  // Verify the webhook signature
  const isValid = await verifyWebhookSignature(payload, signature)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Parse the payload
  const data = JSON.parse(payload)

  // Route to appropriate handler
  try {
    switch (event) {
      case 'pull_request':
        await handlePullRequest(data as PullRequestPayload)
        break
      case 'issue_comment':
        await handleIssueComment(data as IssueCommentPayload)
        break
      case 'ping':
        // GitHub sends a ping when the webhook is first set up
        return NextResponse.json({ message: 'pong' })
      default:
        // Ignore other events
        return NextResponse.json({ message: `Ignored event: ${event}` })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

// ================================
// Pull Request Event Handler
// ================================

async function handlePullRequest(payload: PullRequestPayload) {
  const { action, pull_request: pr, repository, installation } = payload

  if (!installation) {
    console.log('No installation ID in payload, skipping')
    return
  }

  const connection = await findConnectionForRepo(repository.id, installation.id)
  if (!connection) {
    console.log(`No connection found for repo ${repository.full_name}`)
    return
  }

  // Parse bounty references from PR title and body
  const text = `${pr.title}\n${pr.body || ''}`
  const refs = parseBountyReferences(text)

  // Filter to only references matching this project's key
  const projectKey = connection.project.projectKey
  const matchingRefs = refs.filter(
    (ref) => ref.projectKey.toUpperCase() === projectKey.toUpperCase(),
  )

  // Handle based on action
  if (action === 'opened' || action === 'reopened') {
    if (matchingRefs.length > 0) {
      await handlePROpened(connection, pr, matchingRefs, installation.id)
    }
  } else if (action === 'closed' && pr.merged) {
    // For merges, check both text references AND existing PR links
    // (PRs can be linked via /bounty command without text refs)
    await handlePRMergedWithLinks(connection, pr, matchingRefs)
  }
}

async function handlePROpened(
  connection: GitHubConnectionWithProject,
  pr: PullRequestPayload['pull_request'],
  refs: ReturnType<typeof parseBountyReferences>,
  installationId: number,
) {
  const octokit = await getInstallationOctokit(installationId)
  const [owner, repo] = connection.repoFullName.split('/')
  const bountyInfos: BountyInfo[] = []
  const notFoundRefs: string[] = []
  let unlinkedUserLogin: string | undefined

  // Check if PR author has a Shippy account (check once, reuse for all refs)
  const account = await findShippyAccountByGitHubId(pr.user.id)
  if (!account) {
    unlinkedUserLogin = pr.user.login
  }

  for (const ref of refs) {
    const bounty = await findBountyByNumber(
      connection.project.id,
      ref.bountyNumber,
    )

    if (!bounty) {
      console.log(`Bounty ${ref.fullMatch} not found`)
      notFoundRefs.push(ref.fullMatch)
      continue
    }

    if (!account) {
      console.log(`No Shippy account linked for GitHub user ${pr.user.login}`)
      // Still add to bounty info for the comment, but can't create submission
      bountyInfos.push({
        identifier: ref.fullMatch,
        title: bounty.title,
        points: bounty.points,
        status: bounty.status,
        url: `${APP_URL}${routes.project.bountyDetail({ slug: connection.project.slug, bountyId: bounty.id })}`,
      })
      continue
    }

    // Try to claim the bounty using shared service (handles validation + notifications)
    const claimResult = await claimBounty({
      prisma,
      bountyId: bounty.id,
      userId: account.userId,
    })

    // If claim failed for reasons other than "already claimed by user", skip this bounty
    if (
      !claimResult.success &&
      claimResult.code !== 'ALREADY_CLAIMED_BY_USER'
    ) {
      console.log(
        `Cannot claim bounty ${ref.fullMatch}: ${claimResult.message}`,
      )
      // Still add to bounty info with current status so user sees the link
      bountyInfos.push({
        identifier: ref.fullMatch,
        title: bounty.title,
        points: bounty.points,
        status: bounty.status,
        url: `${APP_URL}${routes.project.bountyDetail({ slug: connection.project.slug, bountyId: bounty.id })}`,
      })
      continue
    }

    // Create the submission using shared service
    const submissionResult = await createSubmission({
      prisma,
      bountyId: bounty.id,
      userId: account.userId,
      description: `Submitted via GitHub PR: ${pr.html_url}`,
      githubPRLink: {
        repoId: connection.repoId,
        prNumber: pr.number,
        prNodeId: pr.node_id,
        prUrl: pr.html_url,
      },
      skipClaimCheck: true, // Claim was just created or already exists
    })

    if (!submissionResult.success) {
      console.log(
        `Failed to create submission for ${ref.fullMatch}: ${submissionResult.message}`,
      )
      continue
    }

    bountyInfos.push({
      identifier: ref.fullMatch,
      title: bounty.title,
      points: bounty.points,
      status: BountyStatus.CLAIMED,
      url: `${APP_URL}${routes.project.bountyDetail({ slug: connection.project.slug, bountyId: bounty.id })}`,
      submissionCreated: true,
    })

    console.log(
      `Created submission ${submissionResult.submission.id} for bounty ${ref.fullMatch}`,
    )
  }

  // Post a comment on the PR with linked bounties
  if (bountyInfos.length > 0) {
    const comment = formatBountyLinkComment(bountyInfos, { unlinkedUserLogin })
    await postComment(octokit, owner, repo, pr.number, comment)
  }

  // Post a comment for any bounties that weren't found
  if (notFoundRefs.length > 0) {
    const notFoundList = notFoundRefs.join(', ')
    const comment =
      notFoundRefs.length === 1
        ? `⚠️ Bounty **${notFoundList}** was not found in this project.`
        : `⚠️ The following bounties were not found in this project: **${notFoundList}**`
    await postComment(octokit, owner, repo, pr.number, comment)
  }
}

/**
 * Handle PR merge - checks both text references AND existing PR links
 * This handles PRs linked via /bounty command (no text refs) as well as
 * PRs that reference bounties in their title/body
 */
async function handlePRMergedWithLinks(
  connection: GitHubConnectionWithProject,
  pr: PullRequestPayload['pull_request'],
  textRefs: ReturnType<typeof parseBountyReferences>,
) {
  // Find ALL PR links for this PR (handles /bounty command cases)
  const allPRLinks = await prisma.gitHubPRLink.findMany({
    where: { prNodeId: pr.node_id },
    include: {
      submission: {
        include: {
          bounty: true,
          user: { select: { id: true } },
        },
      },
    },
  })

  if (allPRLinks.length === 0 && textRefs.length === 0) {
    return // No submissions linked and no text references
  }

  // Process all linked submissions (from /bounty command or earlier PR open)
  for (const prLink of allPRLinks) {
    const submission = prLink.submission
    const bounty = submission.bounty

    // Only process pending submissions for this project
    if (submission.status !== SubmissionStatus.PENDING) {
      continue
    }
    if (bounty.projectId !== connection.project.id) {
      continue
    }

    // Update PR link with merge time regardless of auto-approve setting
    await prisma.gitHubPRLink.update({
      where: { id: prLink.id },
      data: {
        prMergedAt: pr.merged_at ? new Date(pr.merged_at) : new Date(),
      },
    })

    if (connection.autoApproveOnMerge) {
      // Auto-approve the submission
      await autoApproveSubmission(prLink, bounty, connection)
    } else {
      // Notify founder that submission needs manual review
      await createNotifications({
        prisma,
        type: NotificationType.SUBMISSION_PR_MERGED,
        referenceType: NotificationReferenceType.SUBMISSION,
        referenceId: submission.id,
        actorId: submission.user.id,
        recipientIds: [connection.project.founderId],
      })

      console.log(
        `PR merged for submission ${submission.id}, founder notified for manual review`,
      )
    }
  }

  // Also check text references that might not have PR links yet
  // (edge case: someone adds a bounty reference after PR was opened)
  for (const ref of textRefs) {
    const bounty = await findBountyByNumber(
      connection.project.id,
      ref.bountyNumber,
    )
    if (!bounty) continue

    // Check if we already processed this bounty via PR links
    const alreadyProcessed = allPRLinks.some(
      (link) => link.submission.bountyId === bounty.id,
    )
    if (alreadyProcessed) continue

    // Find submission for this bounty (might exist without PR link)
    const submission = await prisma.submission.findFirst({
      where: {
        bountyId: bounty.id,
        status: SubmissionStatus.PENDING,
      },
      include: {
        githubPRLink: true,
        user: { select: { id: true } },
      },
    })

    if (submission?.githubPRLink?.prNodeId === pr.node_id) {
      // Update PR link with merge time
      await prisma.gitHubPRLink.update({
        where: { id: submission.githubPRLink.id },
        data: {
          prMergedAt: pr.merged_at ? new Date(pr.merged_at) : new Date(),
        },
      })

      if (connection.autoApproveOnMerge) {
        await autoApproveSubmission(submission.githubPRLink, bounty, connection)
      } else {
        // Notify founder that submission needs manual review
        await createNotifications({
          prisma,
          type: NotificationType.SUBMISSION_PR_MERGED,
          referenceType: NotificationReferenceType.SUBMISSION,
          referenceId: submission.id,
          actorId: submission.user.id,
          recipientIds: [connection.project.founderId],
        })
      }
    }
  }
}

/**
 * Auto-approve a single submission linked to a merged PR
 * Note: prMergedAt is already set by the caller (handlePRMergedWithLinks)
 *
 * Uses the shared approveSubmission service which handles:
 * - Updating submission status
 * - Updating claim status to COMPLETED
 * - Creating audit trail event
 * - Auto-expanding pool capacity if needed
 * - Marking bounty as COMPLETED if appropriate
 * - Creating notification for contributor
 * - Posting GitHub comment
 */
async function autoApproveSubmission(
  prLink: { id: string; submissionId: string },
  bounty: { id: string; number: number; title: string; points: number | null },
  connection: GitHubConnectionWithProject,
) {
  // Can't auto-approve without points
  if (bounty.points === null) {
    console.log(
      `Skipping auto-approve for bounty ${connection.project.projectKey}-${bounty.number}: no points assigned`,
    )
    return
  }

  // Use the shared approval service
  await approveSubmission({
    prisma,
    submissionId: prLink.submissionId,
    pointsAwarded: bounty.points,
    actorId: connection.project.founderId, // Attribute to founder
    note: 'Auto-approved on PR merge',
  })

  const identifier = `${connection.project.projectKey}-${bounty.number}`
  console.log(`Auto-approved submission for bounty ${identifier} on PR merge`)
}

// ================================
// Issue Comment Handler (Slash Commands)
// ================================

async function handleIssueComment(payload: IssueCommentPayload) {
  const { action, comment, installation } = payload

  if (action !== 'created') return
  if (!installation) return

  const body = comment.body.trim()

  // Check for slash commands
  if (body.startsWith('/claim')) {
    await handleClaimCommand(payload)
  } else if (body.startsWith('/release')) {
    await handleReleaseCommand(payload)
  } else if (body.startsWith('/bounty')) {
    await handleBountyCommand(payload)
  }
}

// ================================
// Bounty Resolution Helpers
// ================================

/**
 * Try to resolve a bounty from various sources for a given issue/PR context.
 * Returns the bounty and its identifier, or null if not found.
 */
async function resolveBountyFromContext(
  ctx: CommandContext,
  issue: IssueCommentPayload['issue'],
  explicitRef: string | null,
): Promise<{
  bounty: Awaited<ReturnType<typeof findBountyByNumber>>
  identifier: string
} | null> {
  const { connection } = ctx
  const project = connection.project

  // 1. Check for explicit reference (e.g., /claim SHP-123)
  if (explicitRef) {
    const refs = parseBountyReferences(explicitRef)
    if (refs[0]) {
      const bounty = await findBountyByNumber(project.id, refs[0].bountyNumber)
      if (bounty) {
        return { bounty, identifier: refs[0].fullMatch }
      }
    }
  }

  // 2. For issues: check if this issue has a linked bounty (via /bounty command)
  if (!issue.pull_request) {
    const issueLink = await prisma.gitHubIssueLink.findUnique({
      where: {
        repoId_issueNumber: {
          repoId: connection.repoId,
          issueNumber: issue.number,
        },
      },
      include: { bounty: true },
    })
    if (issueLink) {
      return {
        bounty: issueLink.bounty,
        identifier: `${project.projectKey}-${issueLink.bounty.number}`,
      }
    }
  }

  // 3. For PRs: check if there's a linked submission (via PR reference)
  if (issue.pull_request) {
    const prLink = await prisma.gitHubPRLink.findFirst({
      where: {
        repoId: connection.repoId,
        prNumber: issue.number,
      },
      include: {
        submission: {
          include: { bounty: true },
        },
      },
    })
    if (prLink) {
      return {
        bounty: prLink.submission.bounty,
        identifier: `${project.projectKey}-${prLink.submission.bounty.number}`,
      }
    }
  }

  // 4. Fallback: try to find reference in issue/PR title/body
  const text = `${issue.title}\n${issue.body || ''}`
  const refs = parseBountyReferences(text).filter(
    (ref) => ref.projectKey.toUpperCase() === project.projectKey.toUpperCase(),
  )
  if (refs[0]) {
    const bounty = await findBountyByNumber(project.id, refs[0].bountyNumber)
    if (bounty) {
      return { bounty, identifier: refs[0].fullMatch }
    }
  }

  return null
}

async function handleClaimCommand(payload: IssueCommentPayload) {
  const { comment, issue } = payload
  const body = comment.body.trim()

  const ctx = await buildCommandContext(payload)
  if (!ctx) return

  const {
    octokit,
    connection,
    owner,
    repo,
    issueNumber,
    commentUserLogin,
    commentUserId,
  } = ctx

  // Find the user's Shippy account
  const account = await findShippyAccountByGitHubId(commentUserId)
  if (!account) {
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `@${commentUserLogin} You need to [sign up on Shippy](${APP_URL}) and link your GitHub account in your user settings (tap your avatar → Settings) before you can claim bounties.`,
    )
    return
  }

  // Extract explicit bounty reference from command
  const explicitMatch = body.match(/\/claim\s+([A-Z]{3,}-\d+)/i)
  const explicitRef = explicitMatch?.[1] ?? null

  // Resolve bounty from context
  const resolved = await resolveBountyFromContext(ctx, issue, explicitRef)
  if (!resolved || !resolved.bounty) {
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `@${commentUserLogin} No bounty reference found. Use \`/claim ${connection.project.projectKey}-123\` to specify a bounty.`,
    )
    return
  }

  const { bounty, identifier } = resolved

  // Use the shared claim service
  const result = await claimBounty({
    prisma,
    bountyId: bounty.id,
    userId: account.userId,
  })

  if (!result.success) {
    // Map error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
      BACKLOG: `Bounty **${identifier}** is in the backlog and cannot be claimed yet.`,
      COMPLETED: `Bounty **${identifier}** has already been completed.`,
      CLOSED: `Bounty **${identifier}** is closed.`,
      ALREADY_CLAIMED_SINGLE: `Bounty **${identifier}** has already been claimed.`,
      ALREADY_CLAIMED_BY_USER: `You already have an active claim on **${identifier}**.`,
      MAX_CLAIMS_REACHED: `Bounty **${identifier}** has reached its maximum number of claims.`,
    }
    const message =
      errorMessages[result.code] ||
      `Cannot claim **${identifier}**: ${result.message}`
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `@${commentUserLogin} ${message}`,
    )
    return
  }

  await postComment(
    octokit,
    owner,
    repo,
    issueNumber,
    `✅ @${commentUserLogin} has claimed **[${identifier}](${APP_URL}${routes.project.bountyDetail({ slug: connection.project.slug, bountyId: bounty.id })})**: ${bounty.title}\n\nThe bounty deadline is ${bounty.claimExpiryDays} days.`,
  )
}

async function handleReleaseCommand(payload: IssueCommentPayload) {
  const { issue } = payload
  const body = payload.comment.body.trim()

  const ctx = await buildCommandContext(payload)
  if (!ctx) return

  const {
    octokit,
    connection,
    owner,
    repo,
    issueNumber,
    commentUserLogin,
    commentUserId,
  } = ctx

  // Find the user's Shippy account
  const account = await findShippyAccountByGitHubId(commentUserId)
  if (!account) {
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `@${commentUserLogin} You need to [sign up on Shippy](${APP_URL}) and link your GitHub account in your user settings (tap your avatar → Settings) before you can release bounty claims.`,
    )
    return
  }

  // Extract explicit bounty reference from command
  const explicitMatch = body.match(/\/release\s+([A-Z]{3,}-\d+)/i)
  const explicitRef = explicitMatch?.[1] ?? null

  // Resolve bounty from context
  const resolved = await resolveBountyFromContext(ctx, issue, explicitRef)
  if (!resolved || !resolved.bounty) {
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `@${commentUserLogin} No bounty reference found. Use \`/release ${connection.project.projectKey}-123\` to specify a bounty.`,
    )
    return
  }

  const { bounty, identifier } = resolved

  // Find the user's active claim on this bounty
  const claim = await prisma.bountyClaim.findFirst({
    where: {
      bountyId: bounty.id,
      userId: account.userId,
      status: ClaimStatus.ACTIVE,
    },
  })

  if (!claim) {
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `@${commentUserLogin} You don't have an active claim on **${identifier}**.`,
    )
    return
  }

  // Use the shared release service
  const result = await releaseClaim({
    prisma,
    claimId: claim.id,
    userId: account.userId,
  })

  if (!result.success) {
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `@${commentUserLogin} Failed to release claim: ${result.message}`,
    )
    return
  }

  await postComment(
    octokit,
    owner,
    repo,
    issueNumber,
    `🔓 @${commentUserLogin} has released their claim on **[${identifier}](${APP_URL}${routes.project.bountyDetail({ slug: connection.project.slug, bountyId: bounty.id })})**: ${bounty.title}\n\nThis bounty is now available for others to claim.`,
  )
}

async function handleBountyCommand(payload: IssueCommentPayload) {
  const { issue } = payload

  const ctx = await buildCommandContext(payload)
  if (!ctx) return

  const {
    octokit,
    connection,
    owner,
    repo,
    issueNumber,
    commentUserLogin,
    commentUserId,
  } = ctx

  // Check if user is the project founder
  const account = await findShippyAccountByGitHubId(commentUserId)
  if (!account) {
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `@${commentUserLogin} You need to [sign up on Shippy](${APP_URL}) and link your GitHub account in your user settings (tap your avatar → Settings) before you can create bounties.`,
    )
    return
  }

  if (account.userId !== connection.project.founderId) {
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `@${commentUserLogin} Only the project founder can create bounties.`,
    )
    return
  }

  // Dispatch to the appropriate handler based on issue vs PR
  if (issue.pull_request) {
    await handleBountyCommandOnPR(payload, ctx)
  } else {
    await handleBountyCommandOnIssue(payload, ctx)
  }
}

// ================================
// Issue-Specific Bounty Creation
// ================================

/**
 * Handle /bounty command on a GitHub Issue
 * Creates a bounty linked to the GitHub issue
 */
async function handleBountyCommandOnIssue(
  payload: IssueCommentPayload,
  ctx: CommandContext,
) {
  const { comment, issue, repository } = payload
  const { octokit, connection, owner, repo, issueNumber, commentUserLogin } =
    ctx
  const body = comment.body.trim()
  const project = connection.project

  // Parse points from command: /bounty 50
  const pointsMatch = body.match(/\/bounty\s+(\d+)/)
  const points = pointsMatch ? parseInt(pointsMatch[1], 10) : null

  // Check if a bounty already exists for this GitHub issue (only block if active)
  const existingLink = await prisma.gitHubIssueLink.findFirst({
    where: {
      repoId: repository.id,
      issueNumber: issue.number,
      bounty: {
        // Only block if the bounty is still active (not closed/completed)
        status: { in: [BountyStatus.OPEN, BountyStatus.CLAIMED] },
      },
    },
    include: { bounty: true },
  })

  if (existingLink) {
    const identifier = `${project.projectKey}-${existingLink.bounty.number}`
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `@${commentUserLogin} An active bounty already exists for this issue: **[${identifier}](${APP_URL}${routes.project.bountyDetail({ slug: project.slug, bountyId: existingLink.bounty.id })})** (${existingLink.bounty.points ?? 'TBD'} pts)`,
    )
    return
  }

  // Use the shared bounty creation service (in a transaction for atomic number reservation)
  const result = await prisma.$transaction(async (tx) => {
    return createBounty({
      prisma: tx,
      projectId: project.id,
      title: issue.title,
      description: issue.body || 'Created from GitHub issue.',
      points,
      githubIssueLink: {
        repoId: repository.id,
        issueNumber: issue.number,
        issueNodeId: issue.node_id,
      },
    })
  })

  if (!result.success) {
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `@${commentUserLogin} Failed to create bounty: ${result.message}`,
    )
    return
  }

  const identifier = `${project.projectKey}-${result.bounty.number}`
  const pointsStr = points !== null ? `${points} pts` : 'TBD'

  await postComment(
    octokit,
    owner,
    repo,
    issueNumber,
    `🚀 Bounty created: **[${identifier}](${APP_URL}${routes.project.bountyDetail({ slug: project.slug, bountyId: result.bounty.id })})** (${pointsStr})\n\nContributors can claim this bounty on Shippy or with \`/claim ${identifier}\``,
  )
}

// ================================
// PR-Specific Bounty Creation
// ================================

/**
 * Handle /bounty command on a GitHub PR
 * Creates a bounty and immediately links the PR as a submission
 */
async function handleBountyCommandOnPR(
  payload: IssueCommentPayload,
  ctx: CommandContext,
) {
  const { comment, issue, repository } = payload
  const { octokit, connection, owner, repo, issueNumber, commentUserLogin } =
    ctx
  const body = comment.body.trim()
  const project = connection.project

  // Parse points from command: /bounty 50
  const pointsMatch = body.match(/\/bounty\s+(\d+)/)
  const points = pointsMatch ? parseInt(pointsMatch[1], 10) : null

  // Check if this PR already has a linked submission with an active bounty
  const existingPRLink = await prisma.gitHubPRLink.findFirst({
    where: {
      repoId: repository.id,
      prNumber: issue.number,
      submission: {
        bounty: {
          // Only block if the bounty is still active (not closed/completed)
          status: { in: [BountyStatus.OPEN, BountyStatus.CLAIMED] },
        },
      },
    },
    include: {
      submission: {
        include: { bounty: true },
      },
    },
  })

  if (existingPRLink) {
    const existingBounty = existingPRLink.submission.bounty
    const identifier = `${project.projectKey}-${existingBounty.number}`
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `@${commentUserLogin} This PR is already linked to an active bounty **[${identifier}](${APP_URL}${routes.project.bountyDetail({ slug: project.slug, bountyId: existingBounty.id })})** (${existingBounty.points ?? 'TBD'} pts)`,
    )
    return
  }

  // Fetch full PR details to get the author and URL
  const { data: prData } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: issue.number,
  })

  // Find the PR author's Shippy account
  const prAuthorAccount = await findShippyAccountByGitHubId(prData.user.id)

  // Use transaction to create bounty + optional claim/submission atomically
  const txResult = await prisma.$transaction(async (tx) => {
    // Create the bounty using shared service
    const result = await createBounty({
      prisma: tx,
      projectId: project.id,
      title: issue.title,
      description: issue.body || 'Created from GitHub PR.',
      points,
    })

    if (!result.success) {
      return result
    }

    const bountyId = result.bounty.id
    const bountyNumber = result.bounty.number

    // If PR author has a Shippy account, create claim and submission
    if (prAuthorAccount) {
      // Use shared claim service (handles validation, status update, notifications)
      const claimResult = await claimBounty({
        prisma: tx,
        bountyId,
        userId: prAuthorAccount.userId,
      })

      if (!claimResult.success) {
        console.error(`Failed to create claim: ${claimResult.message}`)
        // Continue anyway - bounty was created, just won't have submission
      } else {
        // Create the submission with PR link using shared service
        const submissionResult = await createSubmission({
          prisma: tx,
          bountyId,
          userId: prAuthorAccount.userId,
          description: `Submitted via GitHub PR: ${prData.html_url}`,
          githubPRLink: {
            repoId: repository.id,
            prNumber: issue.number,
            prNodeId: prData.node_id,
            prUrl: prData.html_url,
          },
          skipClaimCheck: true, // Claim was just created
        })

        if (!submissionResult.success) {
          console.error(
            `Failed to create submission: ${submissionResult.message}`,
          )
        }
      }
    }

    return {
      success: true as const,
      bountyId,
      bountyNumber,
      hasSubmission: !!prAuthorAccount,
    }
  })

  if (!txResult.success) {
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `@${commentUserLogin} Failed to create bounty: ${txResult.message}`,
    )
    return
  }

  const identifier = `${project.projectKey}-${txResult.bountyNumber}`
  const pointsStr = points !== null ? `${points} pts` : 'TBD'

  if (txResult.hasSubmission) {
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `🚀 Bounty created: **[${identifier}](${APP_URL}${routes.project.bountyDetail({ slug: project.slug, bountyId: txResult.bountyId })})** (${pointsStr})\n\n` +
        `This PR by @${prData.user.login} has been automatically claimed and linked as a submission.`,
    )
  } else {
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `🚀 Bounty created: **[${identifier}](${APP_URL}${routes.project.bountyDetail({ slug: project.slug, bountyId: txResult.bountyId })})** (${pointsStr})\n\n` +
        `@${prData.user.login} To link this PR to the bounty, [sign up on Shippy](${APP_URL}) and link your GitHub account, then reference the bounty in your PR description or use \`/claim ${identifier}\`.`,
    )
  }
}
