/**
 * Shared documentation configuration
 * Used by both the docs index page and the MCP docs server
 */

export interface DocPage {
  id: string
  title: string
  description: string
}

/**
 * All available documentation pages
 * Add new docs here - they'll automatically appear in:
 * - /docs index page
 * - MCP docs server (list_docs / read_doc tools)
 */
export const DOCS: DocPage[] = [
  {
    id: 'mcp-installation',
    title: 'MCP Server Installation',
    description:
      'Install the Shippy MCP server to interact with bounties directly from your AI coding assistant.',
  },
]

export type DocId = (typeof DOCS)[number]['id']
