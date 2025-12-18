import { readFile } from 'node:fs/promises'
import path from 'node:path'
import 'server-only'

export async function readDocsMarkdown(doc: 'mcp-installation') {
  const filePath = path.join(process.cwd(), 'docs', `${doc}.md`)
  return readFile(filePath, 'utf8')
}
