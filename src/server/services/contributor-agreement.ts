import {
  CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION,
  DEFAULT_FORUM_SELECTION,
  DEFAULT_GOVERNING_LAW,
  DEFAULT_POOL_EXPIRATION_NOTICE_DAYS,
} from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { PrismaClient, Project, RewardPool, User } from '@prisma/client'
import crypto from 'crypto'
import 'server-only'

// ================================
// Types
// ================================

type PrismaClientOrTx =
  | PrismaClient
  | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

type ProjectWithRewardPool = Project & {
  rewardPool: RewardPool | null
  founder: Pick<User, 'name'>
}

export interface TermsSnapshot {
  standardMarkdown: string
  projectCustomMarkdown: string | null
  metadata: {
    platformName: string
    platformOperatorLegalName: string
    projectName: string
    projectUrl: string
    projectOwnerLegalName: string
    projectOwnerContactEmail: string
    projectOwnerRepresentativeName: string | null
    projectOwnerRepresentativeTitle: string | null
    paymentProcessorName: string
    rewardPoolCommitmentEndsAt: string | null
    poolExpirationNoticeDays: number
    governingLaw: string
    forumSelection: string
    standardTemplateVersion: number
    projectTermsVersion: number
  }
}

export interface CheckAgreementResult {
  hasValidAgreement: boolean
  requiresAcceptance: boolean
  requiredStandardVersion: number
  requiredProjectVersion: number
  existingAgreement?: {
    id: string
    standardTemplateVersion: number
    projectTermsVersion: number
    acceptedAt: Date
  }
}

export interface AcceptAgreementParams {
  prisma: PrismaClientOrTx
  projectId: string
  userId: string
  userEmail: string
  userName: string
  ipAddress?: string
  userAgent?: string
}

export interface AcceptAgreementResult {
  success: true
  agreementId: string
}

export type AcceptAgreementError =
  | { success: false; code: 'PROJECT_NOT_FOUND'; message: string }
  | { success: false; code: 'ALREADY_ACCEPTED'; message: string }

// ================================
// Template Rendering
// ================================

const TEMPLATE_PATH = 'legal/contributor-agreement-template.md'

// Cache the template content (only read once per process)
let cachedTemplate: string | null = null

async function getStandardTemplate(): Promise<string> {
  if (cachedTemplate) {
    return cachedTemplate
  }

  const fs = await import('fs').then((m) => m.promises)
  const path = await import('path')

  const templatePath = path.join(process.cwd(), TEMPLATE_PATH)
  cachedTemplate = await fs.readFile(templatePath, 'utf-8')
  return cachedTemplate
}

/**
 * Render the contributor agreement template with project-specific values
 */
export async function renderAgreementTemplate(
  project: ProjectWithRewardPool,
  contributor: { name: string; email: string },
  acceptedAt?: Date,
): Promise<{ markdown: string; snapshot: TermsSnapshot }> {
  const template = await getStandardTemplate()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shippy.sh'

  // Build metadata
  const metadata: TermsSnapshot['metadata'] = {
    platformName: 'Shippy',
    platformOperatorLegalName: 'Desiderata, LLC',
    projectName: project.name,
    projectUrl: `${appUrl}${routes.project.detail({ slug: project.slug })}`,
    projectOwnerLegalName:
      project.projectOwnerLegalName || project.founder.name,
    projectOwnerContactEmail: project.projectOwnerContactEmail || '',
    projectOwnerRepresentativeName:
      project.projectOwnerAuthorizedRepresentativeName,
    projectOwnerRepresentativeTitle:
      project.projectOwnerAuthorizedRepresentativeTitle,
    paymentProcessorName: 'Stripe',
    rewardPoolCommitmentEndsAt:
      project.rewardPool?.commitmentEndsAt?.toISOString() || null,
    poolExpirationNoticeDays: DEFAULT_POOL_EXPIRATION_NOTICE_DAYS,
    governingLaw: project.contributorTermsGoverningLaw || DEFAULT_GOVERNING_LAW,
    forumSelection:
      project.contributorTermsForumSelection || DEFAULT_FORUM_SELECTION,
    standardTemplateVersion: CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION,
    projectTermsVersion: project.contributorTermsVersion,
  }

  // Build replacements map
  const replacements: Record<string, string> = {
    '{platform_name}': metadata.platformName,
    '{platform_operator_legal_name}': metadata.platformOperatorLegalName,
    '{project_name}': metadata.projectName,
    '{project_url}': metadata.projectUrl,
    '{project_owner_party_legal_name}': metadata.projectOwnerLegalName,
    '{project_owner_contact_email}':
      metadata.projectOwnerContactEmail || '(not specified)',
    '{project_owner_authorized_representative_name}':
      metadata.projectOwnerRepresentativeName || 'N/A',
    '{project_owner_authorized_representative_title}':
      metadata.projectOwnerRepresentativeTitle || '',
    '{payment_processor_name}': metadata.paymentProcessorName,
    '{reward_pool_commitment_ends_at}': metadata.rewardPoolCommitmentEndsAt
      ? new Date(metadata.rewardPoolCommitmentEndsAt).toLocaleDateString(
          'en-US',
          {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          },
        )
      : '(no commitment end date specified)',
    '{pool_expiration_notice_days}': String(metadata.poolExpirationNoticeDays),
    '{governing_law}': metadata.governingLaw,
    '{forum_selection}': metadata.forumSelection,
    '{contributor_display_name}': contributor.name,
    '{contributor_legal_name_or_display_name}': contributor.name,
    '{contributor_contact_email}': contributor.email,
    '{accepted_at}': acceptedAt?.toISOString() || '(pending)',
    '{acceptance_record_id}': '(will be assigned upon acceptance)',
  }

  // Apply replacements
  let markdown = template
  for (const [placeholder, value] of Object.entries(replacements)) {
    markdown = markdown.replace(
      new RegExp(escapeRegExp(placeholder), 'g'),
      value,
    )
  }

  // Remove HTML comments (template variable documentation)
  markdown = markdown.replace(/<!--[\s\S]*?-->/g, '')

  const snapshot: TermsSnapshot = {
    standardMarkdown: markdown,
    projectCustomMarkdown: project.contributorTermsCustom,
    metadata,
  }

  return { markdown, snapshot }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ================================
// Agreement Checking
// ================================

/**
 * Check if a user has a valid contributor agreement for a project
 */
export async function checkAgreement(
  prisma: PrismaClientOrTx,
  projectId: string,
  userId: string,
): Promise<CheckAgreementResult> {
  // Get project's current terms version
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      contributorTermsEnabled: true,
      contributorTermsVersion: true,
    },
  })

  if (!project) {
    return {
      hasValidAgreement: false,
      requiresAcceptance: true,
      requiredStandardVersion: CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION,
      requiredProjectVersion: 1,
    }
  }

  // If terms are disabled, no agreement is required
  if (!project.contributorTermsEnabled) {
    return {
      hasValidAgreement: true,
      requiresAcceptance: false,
      requiredStandardVersion: CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION,
      requiredProjectVersion: project.contributorTermsVersion,
    }
  }

  // Look for the most recent agreement
  const existingAgreement = await prisma.contributorAgreement.findFirst({
    where: {
      projectId,
      userId,
    },
    orderBy: {
      acceptedAt: 'desc',
    },
    select: {
      id: true,
      standardTemplateVersion: true,
      projectTermsVersion: true,
      acceptedAt: true,
    },
  })

  if (!existingAgreement) {
    return {
      hasValidAgreement: false,
      requiresAcceptance: true,
      requiredStandardVersion: CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION,
      requiredProjectVersion: project.contributorTermsVersion,
    }
  }

  // Check if versions match
  const isCurrentVersion =
    existingAgreement.standardTemplateVersion ===
      CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION &&
    existingAgreement.projectTermsVersion === project.contributorTermsVersion

  return {
    hasValidAgreement: isCurrentVersion,
    requiresAcceptance: !isCurrentVersion,
    requiredStandardVersion: CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION,
    requiredProjectVersion: project.contributorTermsVersion,
    existingAgreement: {
      id: existingAgreement.id,
      standardTemplateVersion: existingAgreement.standardTemplateVersion,
      projectTermsVersion: existingAgreement.projectTermsVersion,
      acceptedAt: existingAgreement.acceptedAt,
    },
  }
}

// ================================
// Agreement Acceptance
// ================================

/**
 * Hash the terms snapshot for integrity verification
 */
function hashTermsSnapshot(snapshot: TermsSnapshot): string {
  const canonicalized = JSON.stringify(snapshot, Object.keys(snapshot).sort())
  return crypto.createHash('sha256').update(canonicalized).digest('hex')
}

/**
 * Accept the contributor agreement for a project
 */
export async function acceptAgreement({
  prisma,
  projectId,
  userId,
  userEmail,
  userName,
  ipAddress,
  userAgent,
}: AcceptAgreementParams): Promise<
  AcceptAgreementResult | AcceptAgreementError
> {
  // Get project with reward pool and founder info
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      rewardPool: true,
      founder: {
        select: { name: true },
      },
    },
  })

  if (!project) {
    return {
      success: false,
      code: 'PROJECT_NOT_FOUND',
      message: 'Project not found',
    }
  }

  // Check if already accepted with current versions
  const existing = await checkAgreement(prisma, projectId, userId)
  if (existing.hasValidAgreement) {
    return {
      success: false,
      code: 'ALREADY_ACCEPTED',
      message: 'You have already accepted the current contributor agreement',
    }
  }

  // Render the agreement and create snapshot
  const acceptedAt = new Date()
  const { snapshot } = await renderAgreementTemplate(
    project,
    { name: userName, email: userEmail },
    acceptedAt,
  )
  const termsHash = hashTermsSnapshot(snapshot)

  // Create the agreement record
  const agreement = await prisma.contributorAgreement.create({
    data: {
      projectId,
      userId,
      standardTemplateVersion: CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION,
      projectTermsVersion: project.contributorTermsVersion,
      acceptedAt,
      ipAddress,
      userAgent,
      termsSnapshot: JSON.parse(JSON.stringify(snapshot)),
      termsHash,
    },
  })

  return {
    success: true,
    agreementId: agreement.id,
  }
}

// ================================
// Get Agreement Details
// ================================

/**
 * Get the details of a user's agreement for a project
 */
export async function getAgreementDetails(
  prisma: PrismaClientOrTx,
  projectId: string,
  userId: string,
) {
  return prisma.contributorAgreement.findFirst({
    where: {
      projectId,
      userId,
    },
    orderBy: {
      acceptedAt: 'desc',
    },
    select: {
      id: true,
      standardTemplateVersion: true,
      projectTermsVersion: true,
      acceptedAt: true,
      termsSnapshot: true,
    },
  })
}

// ================================
// Get Template for Display
// ================================

export interface GetTemplateParams {
  prisma: PrismaClientOrTx
  projectId: string
  contributorName?: string
  contributorEmail?: string
}

export interface GetTemplateResult {
  success: true
  markdown: string
  projectCustomTerms: string | null
  standardTemplateVersion: number
  projectTermsVersion: number
  termsEnabled: boolean
  metadata: TermsSnapshot['metadata']
}

export type GetTemplateError = {
  success: false
  code: 'PROJECT_NOT_FOUND'
  message: string
}

/**
 * Get the rendered agreement template for display
 */
export async function getTemplate({
  prisma,
  projectId,
  contributorName = 'Contributor Name',
  contributorEmail = 'contributor@example.com',
}: GetTemplateParams): Promise<GetTemplateResult | GetTemplateError> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      rewardPool: true,
      founder: {
        select: { name: true },
      },
    },
  })

  if (!project) {
    return {
      success: false,
      code: 'PROJECT_NOT_FOUND',
      message: 'Project not found',
    }
  }

  const { markdown, snapshot } = await renderAgreementTemplate(
    project,
    { name: contributorName, email: contributorEmail },
    undefined,
  )

  return {
    success: true,
    markdown,
    projectCustomTerms: project.contributorTermsCustom,
    standardTemplateVersion: CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION,
    projectTermsVersion: project.contributorTermsVersion,
    termsEnabled: project.contributorTermsEnabled,
    metadata: snapshot.metadata,
  }
}

// ================================
// List Acceptances (Founder Only)
// ================================

export interface ListAcceptancesParams {
  prisma: PrismaClientOrTx
  projectId: string
  userId: string
  limit?: number
  cursor?: string
}

export interface ListAcceptancesResult {
  success: true
  agreements: Array<{
    id: string
    standardTemplateVersion: number
    projectTermsVersion: number
    acceptedAt: Date
    user: {
      id: string
      name: string
      username: string | null
      image: string | null
    }
  }>
  nextCursor?: string
}

export type ListAcceptancesError =
  | { success: false; code: 'PROJECT_NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }

/**
 * List contributors who have accepted the agreement (founder only)
 */
export async function listAcceptances({
  prisma,
  projectId,
  userId,
  limit = 50,
  cursor,
}: ListAcceptancesParams): Promise<
  ListAcceptancesResult | ListAcceptancesError
> {
  // Verify project exists and user is founder
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { founderId: true },
  })

  if (!project) {
    return {
      success: false,
      code: 'PROJECT_NOT_FOUND',
      message: 'Project not found',
    }
  }

  if (project.founderId !== userId) {
    return {
      success: false,
      code: 'FORBIDDEN',
      message: 'Only the project founder can view agreement acceptances',
    }
  }

  const agreements = await prisma.contributorAgreement.findMany({
    where: { projectId },
    orderBy: { acceptedAt: 'desc' },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    select: {
      id: true,
      standardTemplateVersion: true,
      projectTermsVersion: true,
      acceptedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
      },
    },
  })

  let nextCursor: string | undefined = undefined
  if (agreements.length > limit) {
    const nextItem = agreements.pop()
    nextCursor = nextItem?.id
  }

  return {
    success: true,
    agreements,
    nextCursor,
  }
}

// ================================
// Preview Template (for project editor)
// ================================

export interface PreviewTemplateParams {
  projectName: string
  projectSlug?: string
  projectOwnerLegalName: string
  projectOwnerContactEmail: string
  projectOwnerRepresentativeName?: string | null
  projectOwnerRepresentativeTitle?: string | null
  governingLaw?: string | null
  forumSelection?: string | null
  customTerms?: string | null
  poolExpirationNoticeDays?: number
  rewardPoolCommitmentEndsAt?: Date | null
}

/**
 * Render a preview of the agreement template with provided settings (no DB required)
 * Used in project editor for preview before saving
 */
export async function renderPreviewTemplate(
  params: PreviewTemplateParams,
): Promise<string> {
  const template = await getStandardTemplate()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shippy.sh'

  const projectUrl = params.projectSlug
    ? `${appUrl}${routes.project.detail({ slug: params.projectSlug })}`
    : `${appUrl}/p/your-project`

  const replacements: Record<string, string> = {
    '{platform_name}': 'Shippy',
    '{platform_operator_legal_name}': 'Desiderata, LLC',
    '{project_name}': params.projectName || 'Your Project',
    '{project_url}': projectUrl,
    '{project_owner_party_legal_name}':
      params.projectOwnerLegalName || '[Legal Entity Name]',
    '{project_owner_contact_email}':
      params.projectOwnerContactEmail || '[contact@example.com]',
    '{project_owner_authorized_representative_name}':
      params.projectOwnerRepresentativeName || 'N/A',
    '{project_owner_authorized_representative_title}':
      params.projectOwnerRepresentativeTitle || '',
    '{payment_processor_name}': 'Stripe',
    '{reward_pool_commitment_ends_at}': params.rewardPoolCommitmentEndsAt
      ? new Date(params.rewardPoolCommitmentEndsAt).toLocaleDateString(
          'en-US',
          {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          },
        )
      : '(no commitment end date specified)',
    '{pool_expiration_notice_days}': String(
      params.poolExpirationNoticeDays ?? DEFAULT_POOL_EXPIRATION_NOTICE_DAYS,
    ),
    '{governing_law}': params.governingLaw || DEFAULT_GOVERNING_LAW,
    '{forum_selection}': params.forumSelection || DEFAULT_FORUM_SELECTION,
    '{contributor_display_name}': '[Contributor Name]',
    '{contributor_legal_name_or_display_name}': '[Contributor Name]',
    '{contributor_contact_email}': '[contributor@example.com]',
    '{accepted_at}': '(pending acceptance)',
    '{acceptance_record_id}': '(will be assigned upon acceptance)',
  }

  // Apply replacements
  let markdown = template
  for (const [placeholder, value] of Object.entries(replacements)) {
    markdown = markdown.replace(
      new RegExp(escapeRegExp(placeholder), 'g'),
      value,
    )
  }

  // Remove HTML comments (template variable documentation)
  markdown = markdown.replace(/<!--[\s\S]*?-->/g, '')

  // Append custom terms if provided
  if (params.customTerms) {
    markdown += `\n\n## Additional Project-Specific Terms\n\n${params.customTerms}`
  }

  return markdown
}
