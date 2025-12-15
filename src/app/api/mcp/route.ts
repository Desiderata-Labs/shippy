import { prisma } from '@/lib/db/server'
import { BountyStatus } from '@/lib/db/types'
import { extractBearerToken, verifyMcpToken } from '@/lib/mcp-token/server'
import { toMarkdown } from '@/lib/mcp/to-markdown'
import { routes } from '@/lib/routes'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'

export const maxDuration = 60

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
              claims: { where: { status: 'ACTIVE' } },
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
              claims: { where: { status: 'ACTIVE' } },
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
            text: 'Authentication required. Generate a token at https://shippy.sh/settings',
          },
        ],
      }
    }

    const claims = await prisma.bountyClaim.findMany({
      where: { userId: authInfo.clientId, status: 'ACTIVE' },
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shippy.sh'
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shippy.sh'
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
