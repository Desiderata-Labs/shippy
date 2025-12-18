import { prisma } from '@/lib/db/server'
import {
  BountyClaimMode,
  BountyStatus,
  ClaimStatus,
  SubmissionStatus,
} from '@/lib/db/types'
import { extractBearerToken, verifyMcpToken } from '@/lib/mcp-token/server'
import { toMarkdown } from '@/lib/mcp/to-markdown'
import { routes } from '@/lib/routes'
import {
  claimBounty,
  closeBounty,
  createBounty,
  releaseClaim,
  reopenBounty,
  updateBounty,
} from '@/server/services/bounty'
import {
  createLabel,
  deleteLabel,
  listLabels,
  updateLabel,
} from '@/server/services/label'
import {
  createProject,
  updateProject,
  updateProjectLogo,
} from '@/server/services/project'
import { createSubmission } from '@/server/services/submission'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'

export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://shippy.sh'

// Single stateless transport instance
const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // Stateless mode
})

// Create and configure the MCP server
const server = new McpServer({
  name: 'Shippy',
  version: '1.0.0',
})

/**
 * Build a project visibility filter based on auth status.
 * - If authenticated: public projects OR private projects owned by the user
 * - If not authenticated: public projects only
 */
function projectVisibilityFilter(userId: string | undefined) {
  if (userId) {
    return {
      OR: [{ isPublic: true }, { founderId: userId }],
    }
  }
  return { isPublic: true }
}

// Register tools
server.registerTool(
  'read_bounty',
  {
    description:
      'Get details of a specific bounty by its identifier (e.g., "SHP-42") or ID',
    inputSchema: {
      identifier: z
        .string()
        .describe('Bounty identifier like "SHP-42" or the bounty ID'),
    },
  },
  async ({ identifier }, extra) => {
    const userId = extra.authInfo?.clientId
    const parsed = parseBountyIdentifier(identifier)
    let bounty

    if (parsed.projectKey && parsed.number !== undefined) {
      bounty = await prisma.bounty.findFirst({
        where: {
          number: parsed.number,
          project: {
            projectKey: parsed.projectKey,
            ...projectVisibilityFilter(userId),
          },
        },
        include: {
          project: { select: { slug: true, name: true, projectKey: true } },
          labels: { include: { label: true } },
          _count: {
            select: {
              claims: { where: { status: ClaimStatus.ACTIVE } },
              submissions: true,
            },
          },
        },
      })
    } else if (parsed.rawId) {
      bounty = await prisma.bounty.findFirst({
        where: {
          id: parsed.rawId,
          project: projectVisibilityFilter(userId),
        },
        include: {
          project: { select: { slug: true, name: true, projectKey: true } },
          labels: { include: { label: true } },
          _count: {
            select: {
              claims: { where: { status: ClaimStatus.ACTIVE } },
              submissions: true,
            },
          },
        },
      })
    }

    if (!bounty) {
      return {
        content: [
          { type: 'text' as const, text: `Bounty "${identifier}" not found.` },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: toMarkdown(formatBounty(bounty), {
            namespace: 'bounty',
            wrapFields: ['description'],
          }),
        },
      ],
    }
  },
)

server.registerTool(
  'list_my_bounties',
  {
    description: 'List all bounties you have claimed (requires authentication)',
    inputSchema: {},
  },
  async (_args, extra) => {
    const authInfo = extra.authInfo
    if (!authInfo?.clientId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Authentication required. Generate a token in your Shippy user profile settings`,
          },
        ],
      }
    }

    const claims = await prisma.bountyClaim.findMany({
      where: { userId: authInfo.clientId, status: ClaimStatus.ACTIVE },
      include: {
        bounty: {
          include: {
            project: { select: { slug: true, name: true, projectKey: true } },
            labels: { include: { label: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (claims.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: "You don't have any active bounty claims.",
          },
        ],
      }
    }

    const bounties = claims.map((claim) => ({
      ...formatBounty(claim.bounty),
      claimExpiresAt: claim.expiresAt.toISOString(),
    }))

    return {
      content: [
        {
          type: 'text' as const,
          text: toMarkdown(bounties, {
            namespace: 'my_bounties',
            wrapFields: ['description'],
          }),
        },
      ],
    }
  },
)

server.registerTool(
  'read_project',
  {
    description: 'Get details of a project by its slug',
    inputSchema: { slug: z.string().describe('Project slug (e.g., "shippy")') },
  },
  async ({ slug }, extra) => {
    const userId = extra.authInfo?.clientId
    const project = await prisma.project.findFirst({
      where: { slug, ...projectVisibilityFilter(userId) },
      include: {
        founder: { select: { name: true, username: true } },
        rewardPool: { select: { poolPercentage: true, payoutFrequency: true } },
        _count: {
          select: { bounties: { where: { status: BountyStatus.OPEN } } },
        },
      },
    })

    if (!project) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Project "${slug}" not found or not accessible.`,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: toMarkdown(formatProject(project), {
            namespace: 'project',
            wrapFields: ['description'],
          }),
        },
      ],
    }
  },
)

server.registerTool(
  'list_projects',
  {
    description:
      'List projects on Shippy. Use `mine: true` to list only your own projects.',
    inputSchema: {
      mine: z
        .boolean()
        .optional()
        .describe('If true, list only your projects (requires auth)'),
      hasOpenBounties: z
        .boolean()
        .optional()
        .describe('If true, only show projects with open bounties'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Max projects to return (default: 20)'),
    },
  },
  async ({ mine, hasOpenBounties, limit = 20 }, extra) => {
    const userId = extra.authInfo?.clientId

    if (mine && !userId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Authentication required to list your projects.',
          },
        ],
      }
    }

    const projects = await prisma.project.findMany({
      where: {
        // If mine=true, only show user's projects; otherwise show all accessible
        ...(mine ? { founderId: userId } : projectVisibilityFilter(userId)),
        ...(hasOpenBounties && {
          bounties: { some: { status: BountyStatus.OPEN } },
        }),
      },
      include: {
        founder: { select: { name: true, username: true } },
        rewardPool: { select: { poolPercentage: true, payoutFrequency: true } },
        _count: {
          select: { bounties: { where: { status: BountyStatus.OPEN } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    if (projects.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: mine
              ? "You don't have any projects yet."
              : 'No projects found.',
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: toMarkdown(projects.map(formatProject), {
            namespace: 'projects',
            wrapFields: ['description'],
          }),
        },
      ],
    }
  },
)

server.registerTool(
  'update_bounty',
  {
    description:
      "Update a bounty's title, description, or acceptance criteria (requires authentication as project founder)",
    inputSchema: {
      identifier: z
        .string()
        .describe('Bounty identifier like "SHP-42" or the bounty ID'),
      title: z
        .string()
        .min(1)
        .max(200)
        .optional()
        .describe('New title for the bounty (plain text string)'),
      description: z
        .string()
        .min(1)
        .optional()
        .describe('New description for the bounty (markdown supported)'),
      acceptance: z
        .string()
        .optional()
        .nullable()
        .describe(
          'New acceptance criteria / evidence requirements (markdown supported). Set to null to clear.',
        ),
      points: z
        .number()
        .int()
        .min(1)
        .optional()
        .nullable()
        .describe(
          'Point reward for completing this bounty. Set to null to move to backlog.',
        ),
      status: z
        .enum(['BACKLOG', 'OPEN', 'CLAIMED', 'COMPLETED', 'CLOSED'])
        .optional()
        .describe(
          'Bounty status. Note: points changes may auto-transition status.',
        ),
      claimMode: z
        .enum(['SINGLE', 'COMPETITIVE', 'MULTIPLE', 'PERFORMANCE'])
        .optional()
        .describe(
          'SINGLE = exclusive (one contributor). COMPETITIVE = race (many claim, first approved wins). MULTIPLE = parallel (many complete, all get points). PERFORMANCE = results-based (points per verified result).',
        ),
      claimExpiryDays: z
        .number()
        .int()
        .min(1)
        .max(90)
        .default(14)
        .optional()
        .describe(
          'Deadline for the work, e.g. days before a claim expires if no submission (1-90). Default: 14.',
        ),
      maxClaims: z
        .number()
        .int()
        .min(1)
        .optional()
        .nullable()
        .describe(
          'Maximum number of claims allowed (only for MULTIPLE mode). Set to null for unlimited.',
        ),
      labelIds: z
        .array(z.string())
        .optional()
        .describe(
          'Array of label IDs to set on the bounty. Pass an empty array to remove all labels.',
        ),
    },
  },
  async (
    {
      identifier,
      title,
      description,
      acceptance,
      points,
      status,
      claimMode,
      claimExpiryDays,
      maxClaims,
      labelIds,
    },
    extra,
  ) => {
    const authInfo = extra.authInfo
    if (!authInfo?.clientId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Authentication required. Generate a token in your Shippy user profile settings.',
          },
        ],
      }
    }

    const userId = authInfo.clientId

    // Resolve bounty ID from identifier (respecting project visibility)
    const parsed = parseBountyIdentifier(identifier)
    let bountyId: string | undefined

    if (parsed.projectKey && parsed.number !== undefined) {
      const bounty = await prisma.bounty.findFirst({
        where: {
          number: parsed.number,
          project: {
            projectKey: parsed.projectKey,
            ...projectVisibilityFilter(userId),
          },
        },
        select: { id: true },
      })
      bountyId = bounty?.id
    } else if (parsed.rawId) {
      const bounty = await prisma.bounty.findFirst({
        where: {
          id: parsed.rawId,
          project: projectVisibilityFilter(userId),
        },
        select: { id: true },
      })
      bountyId = bounty?.id
    }

    if (!bountyId) {
      return {
        content: [
          { type: 'text' as const, text: `Bounty "${identifier}" not found.` },
        ],
      }
    }

    // Check if any updates were provided
    if (
      title === undefined &&
      description === undefined &&
      acceptance === undefined &&
      points === undefined &&
      status === undefined &&
      claimMode === undefined &&
      claimExpiryDays === undefined &&
      maxClaims === undefined &&
      labelIds === undefined
    ) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No updates provided. Specify at least one field to update.',
          },
        ],
      }
    }

    // Call the shared update service
    const result = await updateBounty({
      prisma,
      bountyId,
      userId,
      data: {
        title,
        description,
        evidenceDescription: acceptance,
        points,
        status: status as BountyStatus | undefined,
        claimMode: claimMode as BountyClaimMode | undefined,
        claimExpiryDays,
        maxClaims,
        labelIds,
      },
    })

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: `Bounty "${identifier}" not found.`,
        FORBIDDEN:
          'You do not have permission to update this bounty. Only the project founder can update bounties.',
        NO_CHANGES:
          'No changes detected. The provided values match the current bounty.',
        INVALID_POINTS_CHANGE: result.message,
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: errorMessages[result.code] ?? result.message,
          },
        ],
      }
    }

    // Format the response with what was updated
    const updatedFields = Object.keys(result.changes)
    return {
      content: [
        {
          type: 'text' as const,
          text: `Successfully updated bounty "${identifier}". Updated fields: ${updatedFields.join(', ')}.`,
        },
      ],
    }
  },
)

server.registerTool(
  'create_bounty',
  {
    description:
      'Create a new bounty for a project (requires authentication as project founder)',
    inputSchema: {
      projectSlug: z
        .string()
        .describe('Project slug (e.g., "shippy") to create the bounty in'),
      title: z
        .string()
        .min(1)
        .max(200)
        .describe('Title for the bounty (plain text, max 200 chars)'),
      description: z
        .string()
        .min(1)
        .describe('Description of the bounty (markdown supported)'),
      points: z
        .number()
        .int()
        .min(1)
        .optional()
        .nullable()
        .describe(
          'Point reward for completing this bounty. Omit or set to null to create in BACKLOG status.',
        ),
      acceptance: z
        .string()
        .optional()
        .describe(
          'Acceptance criteria / evidence requirements (markdown supported)',
        ),
      claimMode: z
        .enum(['SINGLE', 'COMPETITIVE', 'MULTIPLE', 'PERFORMANCE'])
        .optional()
        .describe(
          'SINGLE = exclusive (one contributor). COMPETITIVE = race (many claim, first approved wins). MULTIPLE = parallel (many complete, all get points). PERFORMANCE = results-based (points per verified result). Default: SINGLE.',
        ),
      claimExpiryDays: z
        .number()
        .int()
        .min(1)
        .max(90)
        .optional()
        .describe(
          'Days before a claim expires if no submission (1-90). Default: 14.',
        ),
      maxClaims: z
        .number()
        .int()
        .min(1)
        .optional()
        .nullable()
        .describe(
          'Maximum number of claims allowed (only for MULTIPLE mode). Default: unlimited.',
        ),
      labelIds: z
        .array(z.string())
        .optional()
        .describe('Array of label IDs to attach to the bounty.'),
    },
  },
  async (
    {
      projectSlug,
      title,
      description,
      points,
      acceptance,
      claimMode,
      claimExpiryDays,
      maxClaims,
      labelIds,
    },
    extra,
  ) => {
    const authInfo = extra.authInfo
    if (!authInfo?.clientId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Authentication required. Generate a token in your Shippy user profile settings.',
          },
        ],
      }
    }

    // Resolve project ID from slug
    const project = await prisma.project.findFirst({
      where: { slug: projectSlug },
      select: { id: true, name: true, projectKey: true },
    })

    if (!project) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Project "${projectSlug}" not found.`,
          },
        ],
      }
    }

    // Call the shared create service
    const result = await createBounty({
      prisma,
      projectId: project.id,
      userId: authInfo.clientId,
      title,
      description,
      points: points ?? null,
      evidenceDescription: acceptance,
      claimMode: claimMode as BountyClaimMode | undefined,
      claimExpiryDays,
      maxClaims,
      labelIds,
    })

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: `Project "${projectSlug}" not found.`,
        FORBIDDEN:
          'You do not have permission to create bounties. Only the project founder can create bounties.',
        NO_REWARD_POOL:
          'This project does not have a reward pool configured. Set up a reward pool first.',
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: errorMessages[result.code] ?? result.message,
          },
        ],
      }
    }

    const identifier = `${project.projectKey}-${result.bounty.number}`
    const bountyUrl = `${APP_URL}${routes.project.bountyDetail({ slug: projectSlug, bountyId: result.bounty.id })}`

    return {
      content: [
        {
          type: 'text' as const,
          text: `Successfully created bounty "${identifier}": ${result.bounty.title}\n\nStatus: ${result.bounty.status}\nPoints: ${result.bounty.points ?? 'Not set (backlog)'}\nURL: ${bountyUrl}`,
        },
      ],
    }
  },
)

// ================================
// Label Tools
// ================================

server.registerTool(
  'list_labels',
  {
    description: 'List all labels for a project',
    inputSchema: {
      projectSlug: z
        .string()
        .describe('Project slug (e.g., "shippy") to list labels for'),
    },
  },
  async ({ projectSlug }, extra) => {
    const userId = extra.authInfo?.clientId

    // Resolve project ID from slug
    const project = await prisma.project.findFirst({
      where: { slug: projectSlug, ...projectVisibilityFilter(userId) },
      select: { id: true, name: true },
    })

    if (!project) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Project "${projectSlug}" not found or not accessible.`,
          },
        ],
      }
    }

    const result = await listLabels({
      prisma,
      projectId: project.id,
    })

    if (!result.success) {
      return {
        content: [{ type: 'text' as const, text: result.message }],
      }
    }

    if (result.labels.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `No labels found for project "${project.name}".`,
          },
        ],
      }
    }

    const formatted = result.labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
    }))

    return {
      content: [
        {
          type: 'text' as const,
          text: toMarkdown(formatted, { namespace: 'labels' }),
        },
      ],
    }
  },
)

server.registerTool(
  'read_label',
  {
    description: 'Get details of a specific label by ID',
    inputSchema: {
      labelId: z.string().describe('The label ID'),
    },
  },
  async ({ labelId }, extra) => {
    const userId = extra.authInfo?.clientId

    // First get the label to check project visibility
    const label = await prisma.label.findUnique({
      where: { id: labelId },
      include: { project: { select: { isPublic: true, founderId: true } } },
    })

    if (!label) {
      return {
        content: [{ type: 'text' as const, text: `Label not found.` }],
      }
    }

    // Check visibility: public project OR user is founder
    const canAccess =
      label.project.isPublic || label.project.founderId === userId

    if (!canAccess) {
      return {
        content: [
          { type: 'text' as const, text: `Label not found or not accessible.` },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: toMarkdown(
            {
              id: label.id,
              name: label.name,
              color: label.color,
            },
            { namespace: 'label' },
          ),
        },
      ],
    }
  },
)

server.registerTool(
  'create_label',
  {
    description:
      'Create a new label for a project (requires authentication as project founder)',
    inputSchema: {
      projectSlug: z
        .string()
        .describe('Project slug (e.g., "shippy") to create the label in'),
      name: z
        .string()
        .min(1)
        .max(50)
        .describe('Label name (must be unique within the project)'),
      color: z.string().describe('Hex color code (e.g., "#FF5500")'),
    },
  },
  async ({ projectSlug, name, color }, extra) => {
    const authInfo = extra.authInfo
    if (!authInfo?.clientId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Authentication required. Generate a token in your Shippy user profile settings.',
          },
        ],
      }
    }

    // Resolve project ID from slug
    const project = await prisma.project.findFirst({
      where: { slug: projectSlug },
      select: { id: true, name: true },
    })

    if (!project) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Project "${projectSlug}" not found.`,
          },
        ],
      }
    }

    const result = await createLabel({
      prisma,
      projectId: project.id,
      userId: authInfo.clientId,
      name,
      color,
    })

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: `Project "${projectSlug}" not found.`,
        FORBIDDEN:
          'You do not have permission to create labels. Only the project founder can create labels.',
        CONFLICT: `A label named "${name}" already exists in this project.`,
        INVALID_COLOR: 'Invalid hex color format (expected #RRGGBB).',
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: errorMessages[result.code] ?? result.message,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Successfully created label "${result.label.name}" with color ${result.label.color}. Label ID: ${result.label.id}`,
        },
      ],
    }
  },
)

server.registerTool(
  'update_label',
  {
    description: 'Update a label (requires authentication as project founder)',
    inputSchema: {
      labelId: z.string().describe('The label ID to update'),
      name: z.string().min(1).max(50).optional().describe('New label name'),
      color: z
        .string()
        .optional()
        .describe('New hex color code (e.g., "#FF5500")'),
    },
  },
  async ({ labelId, name, color }, extra) => {
    const authInfo = extra.authInfo
    if (!authInfo?.clientId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Authentication required. Generate a token in your Shippy user profile settings.',
          },
        ],
      }
    }

    if (name === undefined && color === undefined) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No updates provided. Specify at least one of: name or color.',
          },
        ],
      }
    }

    const result = await updateLabel({
      prisma,
      labelId,
      userId: authInfo.clientId,
      data: { name, color },
    })

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: 'Label not found.',
        FORBIDDEN:
          'You do not have permission to update this label. Only the project founder can update labels.',
        CONFLICT: `A label named "${name}" already exists in this project.`,
        INVALID_COLOR: 'Invalid hex color format (expected #RRGGBB).',
        NO_CHANGES: 'No changes detected.',
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: errorMessages[result.code] ?? result.message,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Successfully updated label. Name: "${result.label.name}", Color: ${result.label.color}`,
        },
      ],
    }
  },
)

server.registerTool(
  'delete_label',
  {
    description:
      'Delete a label from a project (requires authentication as project founder)',
    inputSchema: {
      labelId: z.string().describe('The label ID to delete'),
    },
  },
  async ({ labelId }, extra) => {
    const authInfo = extra.authInfo
    if (!authInfo?.clientId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Authentication required. Generate a token in your Shippy user profile settings.',
          },
        ],
      }
    }

    const result = await deleteLabel({
      prisma,
      labelId,
      userId: authInfo.clientId,
    })

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: 'Label not found.',
        FORBIDDEN:
          'You do not have permission to delete this label. Only the project founder can delete labels.',
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: errorMessages[result.code] ?? result.message,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: 'Successfully deleted label.',
        },
      ],
    }
  },
)

// ================================
// Bounty Listing & Claim Tools
// ================================

server.registerTool(
  'list_bounties',
  {
    description: 'List bounties for a project',
    inputSchema: {
      projectSlug: z
        .string()
        .describe('Project slug (e.g., "shippy") to list bounties for'),
      status: z
        .enum(['BACKLOG', 'OPEN', 'CLAIMED', 'COMPLETED', 'CLOSED'])
        .optional()
        .describe('Filter by bounty status'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Max bounties to return (default: 50)'),
    },
  },
  async ({ projectSlug, status, limit = 50 }, extra) => {
    const userId = extra.authInfo?.clientId

    // Resolve project from slug
    const project = await prisma.project.findFirst({
      where: { slug: projectSlug, ...projectVisibilityFilter(userId) },
      select: { id: true, name: true, projectKey: true },
    })

    if (!project) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Project "${projectSlug}" not found or not accessible.`,
          },
        ],
      }
    }

    const bounties = await prisma.bounty.findMany({
      where: {
        projectId: project.id,
        ...(status && { status: status as BountyStatus }),
      },
      orderBy: [{ status: 'asc' }, { points: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        project: { select: { slug: true, name: true, projectKey: true } },
        labels: { include: { label: true } },
        _count: {
          select: {
            claims: { where: { status: ClaimStatus.ACTIVE } },
            submissions: true,
          },
        },
      },
    })

    if (bounties.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: status
              ? `No ${status} bounties found for project "${project.name}".`
              : `No bounties found for project "${project.name}".`,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: toMarkdown(bounties.map(formatBounty), {
            namespace: 'bounties',
            wrapFields: ['description'],
          }),
        },
      ],
    }
  },
)

server.registerTool(
  'claim_bounty',
  {
    description:
      'Claim a bounty to start working on it (requires authentication)',
    inputSchema: {
      identifier: z
        .string()
        .describe('Bounty identifier like "SHP-42" or the bounty ID'),
    },
  },
  async ({ identifier }, extra) => {
    const authInfo = extra.authInfo
    if (!authInfo?.clientId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Authentication required. Generate a token in your Shippy user profile settings.',
          },
        ],
      }
    }

    const userId = authInfo.clientId

    // Resolve bounty ID from identifier (respecting project visibility)
    const parsed = parseBountyIdentifier(identifier)
    let bountyId: string | undefined

    if (parsed.projectKey && parsed.number !== undefined) {
      const bounty = await prisma.bounty.findFirst({
        where: {
          number: parsed.number,
          project: {
            projectKey: parsed.projectKey,
            ...projectVisibilityFilter(userId),
          },
        },
        select: { id: true },
      })
      bountyId = bounty?.id
    } else if (parsed.rawId) {
      const bounty = await prisma.bounty.findFirst({
        where: {
          id: parsed.rawId,
          project: projectVisibilityFilter(userId),
        },
        select: { id: true },
      })
      bountyId = bounty?.id
    }

    if (!bountyId) {
      return {
        content: [
          { type: 'text' as const, text: `Bounty "${identifier}" not found.` },
        ],
      }
    }

    const result = await claimBounty({
      prisma,
      bountyId,
      userId: authInfo.clientId,
    })

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: `Bounty "${identifier}" not found.`,
        BACKLOG:
          'This bounty is in the backlog and cannot be claimed yet. Wait for points to be assigned.',
        COMPLETED: 'This bounty has already been completed.',
        CLOSED: 'This bounty is closed.',
        ALREADY_CLAIMED_SINGLE: 'This bounty has already been claimed.',
        ALREADY_CLAIMED_BY_USER: 'You have already claimed this bounty.',
        MAX_CLAIMS_REACHED:
          'This bounty has reached its maximum number of claims.',
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: errorMessages[result.code] ?? result.message,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Successfully claimed bounty "${identifier}". Your claim expires on ${result.claim.expiresAt.toISOString().split('T')[0]}. Submit your work before then!`,
        },
      ],
    }
  },
)

server.registerTool(
  'release_claim',
  {
    description:
      'Release your claim on a bounty (requires authentication). Use bounty identifier.',
    inputSchema: {
      identifier: z
        .string()
        .describe('Bounty identifier like "SHP-42" or the bounty ID'),
      reason: z
        .string()
        .max(1000)
        .optional()
        .describe('Optional reason for releasing the claim'),
    },
  },
  async ({ identifier, reason }, extra) => {
    const authInfo = extra.authInfo
    if (!authInfo?.clientId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Authentication required. Generate a token in your Shippy user profile settings.',
          },
        ],
      }
    }

    // Resolve bounty from identifier
    const parsed = parseBountyIdentifier(identifier)
    let bountyId: string | undefined

    if (parsed.projectKey && parsed.number !== undefined) {
      const bounty = await prisma.bounty.findFirst({
        where: {
          number: parsed.number,
          project: { projectKey: parsed.projectKey },
        },
        select: { id: true },
      })
      bountyId = bounty?.id
    } else if (parsed.rawId) {
      bountyId = parsed.rawId
    }

    if (!bountyId) {
      return {
        content: [
          { type: 'text' as const, text: `Bounty "${identifier}" not found.` },
        ],
      }
    }

    // Find the user's active claim on this bounty
    const claim = await prisma.bountyClaim.findFirst({
      where: {
        bountyId,
        userId: authInfo.clientId,
        status: ClaimStatus.ACTIVE,
      },
    })

    if (!claim) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `You don't have an active claim on bounty "${identifier}".`,
          },
        ],
      }
    }

    const result = await releaseClaim({
      prisma,
      claimId: claim.id,
      userId: authInfo.clientId,
      reason,
    })

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: 'Claim not found.',
        FORBIDDEN: 'You cannot release this claim.',
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: errorMessages[result.code] ?? result.message,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Successfully released your claim on bounty "${identifier}".`,
        },
      ],
    }
  },
)

server.registerTool(
  'close_bounty',
  {
    description:
      'Close a bounty, expiring all claims (requires authentication as project founder)',
    inputSchema: {
      identifier: z
        .string()
        .describe('Bounty identifier like "SHP-42" or the bounty ID'),
      reason: z
        .string()
        .max(1000)
        .optional()
        .describe('Optional reason for closing the bounty'),
    },
  },
  async ({ identifier, reason }, extra) => {
    const authInfo = extra.authInfo
    if (!authInfo?.clientId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Authentication required. Generate a token in your Shippy user profile settings.',
          },
        ],
      }
    }

    const userId = authInfo.clientId

    // Resolve bounty ID from identifier (respecting project visibility)
    const parsed = parseBountyIdentifier(identifier)
    let bountyId: string | undefined

    if (parsed.projectKey && parsed.number !== undefined) {
      const bounty = await prisma.bounty.findFirst({
        where: {
          number: parsed.number,
          project: {
            projectKey: parsed.projectKey,
            ...projectVisibilityFilter(userId),
          },
        },
        select: { id: true },
      })
      bountyId = bounty?.id
    } else if (parsed.rawId) {
      const bounty = await prisma.bounty.findFirst({
        where: {
          id: parsed.rawId,
          project: projectVisibilityFilter(userId),
        },
        select: { id: true },
      })
      bountyId = bounty?.id
    }

    if (!bountyId) {
      return {
        content: [
          { type: 'text' as const, text: `Bounty "${identifier}" not found.` },
        ],
      }
    }

    const result = await closeBounty({
      prisma,
      bountyId,
      userId,
      reason,
    })

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: `Bounty "${identifier}" not found.`,
        FORBIDDEN:
          'You do not have permission to close this bounty. Only the project founder can close bounties.',
        ALREADY_COMPLETED:
          'Cannot close a completed bounty - points have been awarded.',
        ALREADY_CLOSED: 'Bounty is already closed.',
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: errorMessages[result.code] ?? result.message,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Successfully closed bounty "${identifier}".`,
        },
      ],
    }
  },
)

server.registerTool(
  'reopen_bounty',
  {
    description:
      'Reopen a closed bounty (requires authentication as project founder)',
    inputSchema: {
      identifier: z
        .string()
        .describe('Bounty identifier like "SHP-42" or the bounty ID'),
    },
  },
  async ({ identifier }, extra) => {
    const authInfo = extra.authInfo
    if (!authInfo?.clientId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Authentication required. Generate a token in your Shippy user profile settings.',
          },
        ],
      }
    }

    const userId = authInfo.clientId

    // Resolve bounty ID from identifier (respecting project visibility)
    const parsed = parseBountyIdentifier(identifier)
    let bountyId: string | undefined

    if (parsed.projectKey && parsed.number !== undefined) {
      const bounty = await prisma.bounty.findFirst({
        where: {
          number: parsed.number,
          project: {
            projectKey: parsed.projectKey,
            ...projectVisibilityFilter(userId),
          },
        },
        select: { id: true },
      })
      bountyId = bounty?.id
    } else if (parsed.rawId) {
      const bounty = await prisma.bounty.findFirst({
        where: {
          id: parsed.rawId,
          project: projectVisibilityFilter(userId),
        },
        select: { id: true },
      })
      bountyId = bounty?.id
    }

    if (!bountyId) {
      return {
        content: [
          { type: 'text' as const, text: `Bounty "${identifier}" not found.` },
        ],
      }
    }

    const result = await reopenBounty({
      prisma,
      bountyId,
      userId,
    })

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: `Bounty "${identifier}" not found.`,
        FORBIDDEN:
          'You do not have permission to reopen this bounty. Only the project founder can reopen bounties.',
        NOT_CLOSED: 'Only closed bounties can be reopened.',
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: errorMessages[result.code] ?? result.message,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Successfully reopened bounty "${identifier}". New status: ${result.bounty.status}.`,
        },
      ],
    }
  },
)

// ================================
// Submission Tools
// ================================

server.registerTool(
  'create_submission',
  {
    description:
      'Submit work for a claimed bounty (requires authentication). You must have an active claim on the bounty.',
    inputSchema: {
      identifier: z
        .string()
        .describe('Bounty identifier like "SHP-42" or the bounty ID'),
      description: z
        .string()
        .min(1)
        .describe(
          'Description of your work and evidence of completion (markdown supported)',
        ),
    },
  },
  async ({ identifier, description }, extra) => {
    const authInfo = extra.authInfo
    if (!authInfo?.clientId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Authentication required. Generate a token in your Shippy user profile settings.',
          },
        ],
      }
    }

    const userId = authInfo.clientId

    // Resolve bounty from identifier (respecting project visibility)
    const parsed = parseBountyIdentifier(identifier)
    let bounty:
      | { id: string; project: { slug: string; projectKey: string } }
      | undefined

    if (parsed.projectKey && parsed.number !== undefined) {
      const found = await prisma.bounty.findFirst({
        where: {
          number: parsed.number,
          project: {
            projectKey: parsed.projectKey,
            ...projectVisibilityFilter(userId),
          },
        },
        select: {
          id: true,
          project: { select: { slug: true, projectKey: true } },
        },
      })
      bounty = found ?? undefined
    } else if (parsed.rawId) {
      const found = await prisma.bounty.findFirst({
        where: {
          id: parsed.rawId,
          project: projectVisibilityFilter(userId),
        },
        select: {
          id: true,
          project: { select: { slug: true, projectKey: true } },
        },
      })
      bounty = found ?? undefined
    }

    if (!bounty) {
      return {
        content: [
          { type: 'text' as const, text: `Bounty "${identifier}" not found.` },
        ],
      }
    }

    const result = await createSubmission({
      prisma,
      bountyId: bounty.id,
      userId,
      description,
      isDraft: false, // MCP submissions are always submitted immediately
    })

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        NOT_FOUND: `Bounty "${identifier}" not found.`,
        NO_CLAIM:
          'You must claim this bounty before submitting. Use claim_bounty first.',
        ALREADY_SUBMITTED: 'You already have a submission for this bounty.',
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: errorMessages[result.code] ?? result.message,
          },
        ],
      }
    }

    const submissionUrl = `${APP_URL}${routes.project.submissionDetail({ slug: bounty.project.slug, submissionId: result.submission.id })}`

    return {
      content: [
        {
          type: 'text' as const,
          text: `Successfully submitted work for bounty "${identifier}".\n\nYour submission is now pending review by the project founder.\n\nSubmission URL: ${submissionUrl}`,
        },
      ],
    }
  },
)

server.registerTool(
  'list_my_submissions',
  {
    description: 'List your submissions (requires authentication)',
    inputSchema: {
      status: z
        .enum([
          'DRAFT',
          'PENDING',
          'NEEDS_INFO',
          'APPROVED',
          'REJECTED',
          'WITHDRAWN',
        ])
        .optional()
        .describe('Filter by submission status'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Max submissions to return (default: 20)'),
    },
  },
  async ({ status, limit = 20 }, extra) => {
    const authInfo = extra.authInfo
    if (!authInfo?.clientId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Authentication required. Generate a token in your Shippy user profile settings.',
          },
        ],
      }
    }

    const submissions = await prisma.submission.findMany({
      where: {
        userId: authInfo.clientId,
        ...(status && { status: status as SubmissionStatus }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        bounty: {
          include: {
            project: { select: { slug: true, name: true, projectKey: true } },
          },
        },
      },
    })

    if (submissions.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: status
              ? `You don't have any ${status} submissions.`
              : "You don't have any submissions yet.",
          },
        ],
      }
    }

    const formatted = submissions.map((sub) => ({
      bountyIdentifier: `${sub.bounty.project.projectKey}-${sub.bounty.number}`,
      bountyTitle: sub.bounty.title,
      project: sub.bounty.project.name,
      status: sub.status,
      pointsAwarded: sub.pointsAwarded,
      submittedAt: sub.createdAt.toISOString(),
      url: `${APP_URL}${routes.project.submissionDetail({ slug: sub.bounty.project.slug, submissionId: sub.id })}`,
    }))

    return {
      content: [
        {
          type: 'text' as const,
          text: toMarkdown(formatted, { namespace: 'my_submissions' }),
        },
      ],
    }
  },
)

// ================================
// Project Management Tools
// ================================

server.registerTool(
  'create_project',
  {
    description: 'Create a new project (requires authentication as founder)',
    inputSchema: {
      name: z
        .string()
        .min(1)
        .max(100)
        .describe('Project name (1-100 characters)'),
      slug: z
        .string()
        .min(1)
        .max(50)
        .regex(/^[a-z0-9-]+$/)
        .describe(
          'URL slug for the project (lowercase letters, numbers, hyphens)',
        ),
      projectKey: z
        .string()
        .min(1)
        .max(10)
        .describe(
          'Short project key for bounty identifiers (e.g., "SHP" for SHP-42)',
        ),
      tagline: z.string().max(200).optional().describe('Short tagline'),
      description: z
        .string()
        .optional()
        .describe('Full description (markdown)'),
      logoUrl: z.string().url().optional().describe('Logo URL'),
      websiteUrl: z.string().url().optional().describe('Website URL'),
      discordUrl: z.string().url().optional().describe('Discord invite URL'),
      poolPercentage: z
        .number()
        .int()
        .min(1)
        .max(100)
        .describe('Percentage of profit to share with contributors (1-100)'),
      payoutFrequency: z
        .enum(['MONTHLY', 'QUARTERLY'])
        .describe('How often payouts occur'),
      profitBasis: z
        .enum(['NET_PROFIT', 'GROSS_REVENUE'])
        .optional()
        .describe('Basis for profit calculation. Default: NET_PROFIT'),
      commitmentMonths: z
        .number()
        .int()
        .min(6)
        .describe('How many months you commit to the reward pool'),
      payoutVisibility: z
        .enum(['PRIVATE', 'PUBLIC'])
        .optional()
        .describe('Whether payouts are public. Default: PRIVATE'),
    },
  },
  async (input, extra) => {
    const userId = extra.authInfo?.clientId
    if (!userId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Error: Authentication required. Please provide a valid API token.',
          },
        ],
        isError: true,
      }
    }

    const result = await createProject({
      prisma,
      userId,
      name: input.name,
      slug: input.slug,
      projectKey: input.projectKey.toUpperCase(),
      tagline: input.tagline,
      description: input.description,
      logoUrl: input.logoUrl,
      websiteUrl: input.websiteUrl,
      discordUrl: input.discordUrl,
      poolPercentage: input.poolPercentage,
      payoutFrequency: input.payoutFrequency,
      profitBasis: input.profitBasis,
      commitmentMonths: input.commitmentMonths,
      payoutVisibility: input.payoutVisibility,
    })

    if (!result.success) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${result.message}` }],
        isError: true,
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: toMarkdown(
            {
              message: 'Project created successfully',
              project: result.project,
              url: `${APP_URL}${routes.project.detail({ slug: result.project.slug })}`,
            },
            { namespace: 'create_project' },
          ),
        },
      ],
    }
  },
)

server.registerTool(
  'update_project',
  {
    description:
      'Update project settings (requires authentication as project founder)',
    inputSchema: {
      slug: z.string().describe('Current project slug to update'),
      name: z.string().min(1).max(100).optional().describe('New project name'),
      newSlug: z
        .string()
        .min(2)
        .max(50)
        .regex(/^[a-z0-9-]+$/)
        .optional()
        .describe('New URL slug'),
      projectKey: z
        .string()
        .min(1)
        .max(10)
        .optional()
        .describe('New project key'),
      tagline: z.string().max(200).optional().describe('New tagline'),
      description: z.string().optional().describe('New description (markdown)'),
      websiteUrl: z
        .string()
        .url()
        .optional()
        .nullable()
        .describe('Website URL. Set to null to clear.'),
      discordUrl: z
        .string()
        .url()
        .optional()
        .nullable()
        .describe('Discord URL. Set to null to clear.'),
      poolPercentage: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe(
          'New pool percentage. Only allowed before any bounties are claimed.',
        ),
      payoutFrequency: z
        .enum(['MONTHLY', 'QUARTERLY'])
        .optional()
        .describe(
          'New payout frequency. Only allowed before any bounties are claimed.',
        ),
      commitmentMonths: z
        .number()
        .int()
        .min(6)
        .optional()
        .describe(
          'New commitment months. Only allowed before any bounties are claimed.',
        ),
      payoutVisibility: z
        .enum(['PRIVATE', 'PUBLIC'])
        .optional()
        .describe('Whether payouts are public'),
    },
  },
  async (input, extra) => {
    const userId = extra.authInfo?.clientId
    if (!userId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Error: Authentication required. Please provide a valid API token.',
          },
        ],
        isError: true,
      }
    }

    // Find project by slug
    const project = await prisma.project.findFirst({
      where: {
        slug: input.slug,
        ...projectVisibilityFilter(userId),
      },
      select: { id: true },
    })

    if (!project) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: Project "${input.slug}" not found or you don't have access to it.`,
          },
        ],
        isError: true,
      }
    }

    const result = await updateProject({
      prisma,
      projectId: project.id,
      userId,
      data: {
        name: input.name,
        slug: input.newSlug,
        projectKey: input.projectKey?.toUpperCase(),
        tagline: input.tagline,
        description: input.description,
        websiteUrl: input.websiteUrl,
        discordUrl: input.discordUrl,
        poolPercentage: input.poolPercentage,
        payoutFrequency: input.payoutFrequency,
        commitmentMonths: input.commitmentMonths,
        payoutVisibility: input.payoutVisibility,
      },
    })

    if (!result.success) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${result.message}` }],
        isError: true,
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: toMarkdown(
            {
              message: 'Project updated successfully',
              project: result.project,
              url: `${APP_URL}${routes.project.detail({ slug: result.project.slug })}`,
            },
            { namespace: 'update_project' },
          ),
        },
      ],
    }
  },
)

server.registerTool(
  'update_project_logo',
  {
    description:
      'Update project logo (requires authentication as project founder)',
    inputSchema: {
      slug: z.string().describe('Project slug'),
      logoUrl: z
        .string()
        .url()
        .nullable()
        .describe('New logo URL, or null to remove the logo'),
    },
  },
  async (input, extra) => {
    const userId = extra.authInfo?.clientId
    if (!userId) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Error: Authentication required. Please provide a valid API token.',
          },
        ],
        isError: true,
      }
    }

    // Find project by slug
    const project = await prisma.project.findFirst({
      where: {
        slug: input.slug,
        ...projectVisibilityFilter(userId),
      },
      select: { id: true },
    })

    if (!project) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: Project "${input.slug}" not found or you don't have access to it.`,
          },
        ],
        isError: true,
      }
    }

    const result = await updateProjectLogo({
      prisma,
      projectId: project.id,
      userId,
      logoUrl: input.logoUrl,
    })

    if (!result.success) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${result.message}` }],
        isError: true,
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: result.project.logoUrl
            ? `Logo updated successfully. New URL: ${result.project.logoUrl}`
            : 'Logo removed successfully.',
        },
      ],
    }
  },
)

// Connect server to transport
await server.connect(transport)

// Request handler
export async function POST(req: Request) {
  const token = extractBearerToken(req.headers.get('Authorization'))
  let authInfo:
    | { clientId: string; token: string; scopes: string[] }
    | undefined

  if (token) {
    const result = await verifyMcpToken(token)
    if (result) {
      authInfo = { clientId: result.userId, token, scopes: ['read'] }
    }
  }

  return transport.handleRequest(req, authInfo ? { authInfo } : undefined)
}

export async function GET(req: Request) {
  const token = extractBearerToken(req.headers.get('Authorization'))
  let authInfo:
    | { clientId: string; token: string; scopes: string[] }
    | undefined

  if (token) {
    const result = await verifyMcpToken(token)
    if (result) {
      authInfo = { clientId: result.userId, token, scopes: ['read'] }
    }
  }

  return transport.handleRequest(req, { authInfo })
}

export async function DELETE(req: Request) {
  return transport.handleRequest(req)
}

// Helper functions
function parseBountyIdentifier(identifier: string) {
  const match = identifier.match(/^([A-Z]{3})-(\d+)$/i)
  if (match) {
    return {
      projectKey: match[1]!.toUpperCase(),
      number: parseInt(match[2]!, 10),
    }
  }
  return { rawId: identifier }
}

function formatBounty(bounty: {
  id: string
  number: number
  title: string
  description: string
  points: number | null
  status: string
  claimMode: string
  claimExpiryDays: number
  createdAt: Date
  project: { slug: string; name: string; projectKey: string }
  labels?: Array<{ label: { name: string; color: string } }>
  _count?: { claims: number; submissions: number }
}) {
  const baseUrl = APP_URL
  return {
    identifier: `${bounty.project.projectKey}-${bounty.number}`,
    title: bounty.title,
    description: bounty.description,
    points: bounty.points,
    status: bounty.status,
    claimMode: bounty.claimMode,
    claimExpiryDays: bounty.claimExpiryDays,
    labels: bounty.labels?.map((l) => l.label.name) ?? [],
    project: bounty.project.name,
    url: `${baseUrl}${routes.project.bountyDetail({ slug: bounty.project.slug, bountyId: bounty.id })}`,
    createdAt: bounty.createdAt.toISOString(),
    ...(bounty._count && {
      activeClaims: bounty._count.claims,
      submissionCount: bounty._count.submissions,
    }),
  }
}

function formatProject(project: {
  id: string
  slug: string
  name: string
  projectKey: string
  tagline: string | null
  description: string | null
  websiteUrl: string | null
  discordUrl: string | null
  createdAt: Date
  founder?: { name: string; username: string | null }
  rewardPool?: { poolPercentage: number; payoutFrequency: string } | null
  _count?: { bounties: number }
}) {
  const baseUrl = APP_URL
  return {
    name: project.name,
    slug: project.slug,
    projectKey: project.projectKey,
    tagline: project.tagline,
    description: project.description,
    url: `${baseUrl}${routes.project.detail({ slug: project.slug })}`,
    websiteUrl: project.websiteUrl,
    discordUrl: project.discordUrl,
    founder: project.founder?.name,
    rewardPoolPercentage: project.rewardPool?.poolPercentage,
    payoutFrequency: project.rewardPool?.payoutFrequency,
    openBounties: project._count?.bounties ?? 0,
    createdAt: project.createdAt.toISOString(),
  }
}
