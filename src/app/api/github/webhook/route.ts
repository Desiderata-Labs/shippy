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
  formatAutoApproveComment,
  formatBountyLinkComment,
  getInstallationOctokit,
  parseBountyReferences,
  verifyWebhookSignature,
} from '@/lib/github/server'
import { routes } from '@/lib/routes'
import { createNotifications } from '@/server/routers/notification'
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
    await handlePRMergedWithLinks(connection, pr, matchingRefs, installation.id)
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

    // Create a claim if user doesn't already have one
    const existingClaim = await prisma.bountyClaim.findFirst({
      where: {
        bountyId: bounty.id,
        userId: account.userId,
        status: ClaimStatus.ACTIVE,
      },
    })

    if (!existingClaim) {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + bounty.claimExpiryDays)

      await prisma.bountyClaim.create({
        data: {
          bountyId: bounty.id,
          userId: account.userId,
          expiresAt,
        },
      })
    }

    // Create the submission
    const submission = await prisma.submission.create({
      data: {
        bountyId: bounty.id,
        userId: account.userId,
        description: `Submitted via GitHub PR: ${pr.html_url}`,
        status: SubmissionStatus.PENDING,
        githubPRLink: {
          create: {
            repoId: connection.repoId,
            prNumber: pr.number,
            prNodeId: pr.node_id,
            prUrl: pr.html_url,
          },
        },
      },
    })

    // Update bounty status if needed
    if (
      bounty.status === BountyStatus.OPEN ||
      bounty.status === BountyStatus.CLAIMED
    ) {
      await prisma.bounty.update({
        where: { id: bounty.id },
        data: { status: BountyStatus.CLAIMED },
      })
    }

    bountyInfos.push({
      identifier: ref.fullMatch,
      title: bounty.title,
      points: bounty.points,
      status: BountyStatus.CLAIMED,
      url: `${APP_URL}${routes.project.bountyDetail({ slug: connection.project.slug, bountyId: bounty.id })}`,
    })

    console.log(
      `Created submission ${submission.id} for bounty ${ref.fullMatch}`,
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
  installationId: number,
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

  const octokit = await getInstallationOctokit(installationId)
  const [owner, repo] = connection.repoFullName.split('/')

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
      await autoApproveSubmission(
        prLink,
        bounty,
        pr,
        connection,
        octokit,
        owner,
        repo,
      )
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
        await autoApproveSubmission(
          submission.githubPRLink,
          bounty,
          pr,
          connection,
          octokit,
          owner,
          repo,
        )
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
 */
async function autoApproveSubmission(
  prLink: { id: string; submissionId: string },
  bounty: { id: string; number: number; title: string; points: number | null },
  pr: PullRequestPayload['pull_request'],
  connection: GitHubConnectionWithProject,
  octokit: Awaited<ReturnType<typeof getInstallationOctokit>>,
  owner: string,
  repo: string,
) {
  // Approve the submission
  await prisma.submission.update({
    where: { id: prLink.submissionId },
    data: {
      status: SubmissionStatus.APPROVED,
      pointsAwarded: bounty.points,
      approvedAt: new Date(),
    },
  })

  // Update bounty status
  await prisma.bounty.update({
    where: { id: bounty.id },
    data: { status: BountyStatus.COMPLETED },
  })

  // Post approval comment
  const identifier = `${connection.project.projectKey}-${bounty.number}`
  const bountyInfo: BountyInfo = {
    identifier,
    title: bounty.title,
    points: bounty.points,
    status: BountyStatus.COMPLETED,
    url: `${APP_URL}${routes.project.bountyDetail({ slug: connection.project.slug, bountyId: bounty.id })}`,
  }
  const comment = formatAutoApproveComment(bountyInfo)
  await postComment(octokit, owner, repo, pr.number, comment)

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

  // Check if bounty is claimable
  if (bounty.status !== BountyStatus.OPEN) {
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `@${commentUserLogin} Bounty **${identifier}** is not open for claims (status: ${bounty.status}).`,
    )
    return
  }

  // Check for existing claim
  const existingClaim = await prisma.bountyClaim.findFirst({
    where: {
      bountyId: bounty.id,
      userId: account.userId,
      status: ClaimStatus.ACTIVE,
    },
  })

  if (existingClaim) {
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `@${commentUserLogin} You already have an active claim on **${identifier}**.`,
    )
    return
  }

  // Create the claim
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + bounty.claimExpiryDays)

  await prisma.bountyClaim.create({
    data: {
      bountyId: bounty.id,
      userId: account.userId,
      expiresAt,
    },
  })

  // Update bounty status
  await prisma.bounty.update({
    where: { id: bounty.id },
    data: { status: BountyStatus.CLAIMED },
  })

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

  // Release the claim
  await prisma.bountyClaim.update({
    where: { id: claim.id },
    data: { status: ClaimStatus.RELEASED },
  })

  // Only set bounty back to OPEN if it's currently CLAIMED (not COMPLETED/CLOSED)
  if (bounty.status === BountyStatus.CLAIMED) {
    const otherActiveClaims = await prisma.bountyClaim.count({
      where: {
        bountyId: bounty.id,
        status: ClaimStatus.ACTIVE,
      },
    })

    // If no other claims, set bounty back to OPEN
    if (otherActiveClaims === 0) {
      await prisma.bounty.update({
        where: { id: bounty.id },
        data: { status: BountyStatus.OPEN },
      })
    }
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

  // Create the bounty with GitHub issue link
  const bountyNumber = project.nextBountyNumber

  const bounty = await prisma.bounty.create({
    data: {
      projectId: project.id,
      number: bountyNumber,
      title: issue.title,
      description: issue.body || 'Created from GitHub issue.',
      points,
      status: BountyStatus.OPEN,
      githubIssueLink: {
        create: {
          repoId: repository.id,
          issueNumber: issue.number,
          issueNodeId: issue.node_id,
        },
      },
    },
  })

  // Increment the project's bounty counter
  await prisma.project.update({
    where: { id: project.id },
    data: { nextBountyNumber: bountyNumber + 1 },
  })

  const identifier = `${project.projectKey}-${bountyNumber}`
  const pointsStr = points !== null ? `${points} pts` : 'TBD'

  await postComment(
    octokit,
    owner,
    repo,
    issueNumber,
    `🚀 Bounty created: **[${identifier}](${APP_URL}${routes.project.bountyDetail({ slug: project.slug, bountyId: bounty.id })})** (${pointsStr})\n\nContributors can claim this bounty on Shippy or with \`/claim ${identifier}\``,
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

  // Create the bounty
  const bountyNumber = project.nextBountyNumber

  const bounty = await prisma.bounty.create({
    data: {
      projectId: project.id,
      number: bountyNumber,
      title: issue.title,
      description: issue.body || 'Created from GitHub PR.',
      points,
      status: prAuthorAccount ? BountyStatus.CLAIMED : BountyStatus.OPEN,
    },
  })

  // Increment the project's bounty counter
  await prisma.project.update({
    where: { id: project.id },
    data: { nextBountyNumber: bountyNumber + 1 },
  })

  const identifier = `${project.projectKey}-${bountyNumber}`
  const pointsStr = points !== null ? `${points} pts` : 'TBD'

  // If PR author has a Shippy account, create a claim and submission linked to this PR
  if (prAuthorAccount) {
    // Create the claim
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + bounty.claimExpiryDays)

    await prisma.bountyClaim.create({
      data: {
        bountyId: bounty.id,
        userId: prAuthorAccount.userId,
        expiresAt,
      },
    })

    // Create the submission
    await prisma.submission.create({
      data: {
        bountyId: bounty.id,
        userId: prAuthorAccount.userId,
        description: `Submitted via GitHub PR: ${prData.html_url}`,
        status: SubmissionStatus.PENDING,
        githubPRLink: {
          create: {
            repoId: repository.id,
            prNumber: issue.number,
            prNodeId: prData.node_id,
            prUrl: prData.html_url,
          },
        },
      },
    })

    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `🚀 Bounty created: **[${identifier}](${APP_URL}${routes.project.bountyDetail({ slug: project.slug, bountyId: bounty.id })})** (${pointsStr})\n\n` +
        `This PR by @${prData.user.login} has been automatically claimed and linked as a submission.`,
    )
  } else {
    await postComment(
      octokit,
      owner,
      repo,
      issueNumber,
      `🚀 Bounty created: **[${identifier}](${APP_URL}${routes.project.bountyDetail({ slug: project.slug, bountyId: bounty.id })})** (${pointsStr})\n\n` +
        `@${prData.user.login} To link this PR to the bounty, [sign up on Shippy](${APP_URL}) and link your GitHub account, then reference the bounty in your PR description or use \`/claim ${identifier}\`.`,
    )
  }
}
