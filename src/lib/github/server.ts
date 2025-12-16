import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'
import { Webhooks } from '@octokit/webhooks'
import 'server-only'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://shippy.sh'

// ================================
// Environment Configuration
// ================================

function getGitHubAppConfig() {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET

  if (!appId || !privateKey || !webhookSecret) {
    throw new Error(
      'Missing GitHub App configuration. Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, and GITHUB_WEBHOOK_SECRET.',
    )
  }

  return {
    appId,
    // Private key may be stored with escaped newlines
    privateKey: privateKey.replace(/\\n/g, '\n'),
    webhookSecret,
  }
}

// ================================
// Webhook Verification
// ================================

let webhooksInstance: Webhooks | null = null

export function getWebhooks(): Webhooks {
  if (!webhooksInstance) {
    const config = getGitHubAppConfig()
    webhooksInstance = new Webhooks({
      secret: config.webhookSecret,
    })
  }
  return webhooksInstance
}

/**
 * Verify the webhook signature from GitHub
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
): Promise<boolean> {
  const webhooks = getWebhooks()
  return webhooks.verify(payload, signature)
}

// ================================
// GitHub App Authentication
// ================================

/**
 * Get an authenticated Octokit instance for a specific installation
 * This allows the app to act on behalf of the installation (e.g., post comments)
 */
export async function getInstallationOctokit(
  installationId: number,
): Promise<Octokit> {
  const config = getGitHubAppConfig()

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.appId,
      privateKey: config.privateKey,
      installationId,
    },
  })

  return octokit
}

/**
 * Get an Octokit instance authenticated as the GitHub App itself
 * Used for app-level operations (not installation-specific)
 */
export function getAppOctokit(): Octokit {
  const config = getGitHubAppConfig()

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.appId,
      privateKey: config.privateKey,
    },
  })
}

// ================================
// Bounty Reference Parsing
// ================================

/**
 * Pattern to match bounty references like SHP-123, OTH-456, etc.
 * Matches exactly 3 uppercase letters followed by dash and 1+ digit number
 */
const BOUNTY_REF_PATTERN = /\b([A-Z]{3})-(\d+)\b/g

export interface BountyReference {
  projectKey: string
  bountyNumber: number
  fullMatch: string
}

/**
 * Extract bounty references from text (PR title, body, commit message, etc.)
 */
export function parseBountyReferences(text: string): BountyReference[] {
  const matches: BountyReference[] = []
  let match: RegExpExecArray | null

  // Reset regex state
  BOUNTY_REF_PATTERN.lastIndex = 0

  while ((match = BOUNTY_REF_PATTERN.exec(text)) !== null) {
    matches.push({
      projectKey: match[1],
      bountyNumber: parseInt(match[2], 10),
      fullMatch: match[0],
    })
  }

  // Deduplicate by full match
  const seen = new Set<string>()
  return matches.filter((ref) => {
    if (seen.has(ref.fullMatch)) return false
    seen.add(ref.fullMatch)
    return true
  })
}

// ================================
// Comment Formatting
// ================================

export interface BountyInfo {
  identifier: string // e.g., "SHP-123"
  title: string
  points: number | null
  status: string
  url: string
}

/**
 * Format a comment to post on a PR/issue when a bounty reference is detected
 */
export function formatBountyLinkComment(
  bounties: BountyInfo[],
  options?: { unlinkedUserLogin?: string },
): string {
  if (bounties.length === 0) return ''

  const lines = ['### 🚀 Shippy Bounty Linked', '']

  for (const bounty of bounties) {
    const pointsStr = bounty.points !== null ? `${bounty.points} pts` : 'TBD'
    lines.push(
      `- **[${bounty.identifier}](${bounty.url})**: ${bounty.title} (${pointsStr}) — \`${bounty.status}\``,
    )
  }

  lines.push('')

  if (options?.unlinkedUserLogin) {
    lines.push(
      `@${options.unlinkedUserLogin} To link this PR to the bounty and earn points, ` +
        `[sign up on Shippy](${APP_URL}) and link your GitHub account in Settings, ` +
        `then use \`/claim\` to claim it.`,
    )
  } else {
    lines.push(
      '_A submission has been created for this PR. ' +
        'If auto-approve is enabled, it will be approved when the PR merges._',
    )
  }

  return lines.join('\n')
}

/**
 * Format a comment for when a submission is auto-approved
 */
export function formatAutoApproveComment(bounty: BountyInfo): string {
  return [
    '### ✅ Submission Approved',
    '',
    `This PR has been merged and the submission for **[${bounty.identifier}](${bounty.url})** has been automatically approved.`,
    '',
    bounty.points !== null
      ? `**${bounty.points} points** have been awarded. 🎉`
      : '_Points will be assigned when the bounty is estimated._',
  ].join('\n')
}
