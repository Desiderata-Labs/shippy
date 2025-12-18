import { DOCS, type DocId } from '@/../docs/config'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

export const maxDuration = 60

async function readDocMarkdown(docId: DocId): Promise<string | null> {
  try {
    const filePath = path.join(process.cwd(), 'docs', `${docId}.md`)
    return await readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

// Single stateless transport instance
const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // Stateless mode
})

// Create and configure the MCP server
const server = new McpServer({
  name: 'Shippy Docs',
  version: '1.0.0',
})

// Register tools
server.registerTool(
  'list_docs',
  {
    description: 'List all available Shippy documentation pages',
    inputSchema: {},
  },
  async () => {
    const docs = DOCS.map((doc) => ({
      id: doc.id,
      title: doc.title,
      description: doc.description,
    }))

    return {
      content: [
        {
          type: 'text' as const,
          text: `# Available Documentation\n\n${docs.map((d) => `## ${d.title}\n\n**ID:** \`${d.id}\`\n\n${d.description}`).join('\n\n---\n\n')}`,
        },
      ],
    }
  },
)

server.registerTool(
  'read_doc',
  {
    description: 'Read a specific documentation page by its ID',
    inputSchema: {
      docId: z
        .string()
        .describe(
          'The documentation ID (e.g., "mcp-installation"). Use list_docs to see available IDs.',
        ),
    },
  },
  async ({ docId }) => {
    // Validate docId
    const validDoc = DOCS.find((d) => d.id === docId)
    if (!validDoc) {
      const validIds = DOCS.map((d) => d.id).join(', ')
      return {
        content: [
          {
            type: 'text' as const,
            text: `Documentation "${docId}" not found. Available docs: ${validIds}`,
          },
        ],
      }
    }

    const markdown = await readDocMarkdown(docId as DocId)
    if (!markdown) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error reading documentation "${docId}".`,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: markdown,
        },
      ],
    }
  },
)

// Connect server to transport
await server.connect(transport)

// Request handlers - no auth required for public docs
export async function POST(req: Request) {
  return transport.handleRequest(req)
}

export async function GET(req: Request) {
  return transport.handleRequest(req)
}

export async function DELETE(req: Request) {
  return transport.handleRequest(req)
}
