import { prisma } from '@/lib/db/server'
import { BountyClaimMode, BountyStatus, ClaimStatus } from '@/lib/db/types'
import { extractBearerToken, verifyMcpToken } from '@/lib/mcp-token/server'
import { toMarkdown } from '@/lib/mcp/to-markdown'
import { routes } from '@/lib/routes'
import { updateBounty } from '@/server/services/bounty'
import {
  createLabel,
  getLabel,
  listLabels,
  updateLabel,
} from '@/server/services/label'
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
  async ({ identifier }) => {
    const parsed = parseBountyIdentifier(identifier)
    let bounty

    if (parsed.projectKey && parsed.number !== undefined) {
      bounty = await prisma.bounty.findFirst({
        where: {
          number: parsed.number,
          project: { projectKey: parsed.projectKey, isPublic: true },
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
        where: { id: parsed.rawId, project: { isPublic: true } },
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
  async ({ slug }) => {
    const project = await prisma.project.findFirst({
      where: { slug, isPublic: true },
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
            text: `Project "${slug}" not found or is not public.`,
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
      'List public projects on Shippy. Use `mine: true` to list your own projects.',
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
    const authInfo = extra.authInfo

    if (mine && !authInfo?.clientId) {
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
        ...(mine && authInfo?.clientId
          ? { founderId: authInfo.clientId }
          : { isPublic: true }),
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
              : 'No public projects found.',
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
        .enum(['SINGLE', 'MULTIPLE'])
        .optional()
        .describe(
          'SINGLE = exclusive (one contributor), MULTIPLE = competitive (multiple contributors can work on it but only one gets rewarded).',
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

    // Resolve bounty ID from identifier
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
      userId: authInfo.clientId,
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
  async ({ projectSlug }) => {
    // Resolve project ID from slug
    const project = await prisma.project.findFirst({
      where: { slug: projectSlug, isPublic: true },
      select: { id: true, name: true },
    })

    if (!project) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Project "${projectSlug}" not found or is not public.`,
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
  async ({ labelId }) => {
    const result = await getLabel({
      prisma,
      labelId,
    })

    if (!result.success) {
      return {
        content: [{ type: 'text' as const, text: `Label not found.` }],
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: toMarkdown(
            {
              id: result.label.id,
              name: result.label.name,
              color: result.label.color,
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
