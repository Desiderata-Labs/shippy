import {
  OpenGraphImage,
  contentType,
  size,
} from '@/components/app/opengraph-image'

export const alt = 'MCP Server Installation - Shippy'
export { size, contentType }

export default async function Image() {
  return OpenGraphImage({
    title: 'MCP Server Installation',
    description:
      'Install the Shippy MCP server to interact with bounties directly from your AI coding assistant.',
  })
}
