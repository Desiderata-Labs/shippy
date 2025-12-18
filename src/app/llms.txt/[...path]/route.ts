import { readFile } from 'node:fs/promises'
import path from 'node:path'
import 'server-only'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: pathSegments } = await params
  const filePath = pathSegments.join('/')

  // Only allow .md files
  if (!filePath.endsWith('.md')) {
    return new Response('Not Found', { status: 404 })
  }

  // Remove .md extension to get the doc path
  let docPath = filePath.slice(0, -3)

  // Strip 'docs/' prefix if present (since we're already in the docs directory)
  if (docPath.startsWith('docs/')) {
    docPath = docPath.slice(5)
  }

  // Security: prevent directory traversal
  if (docPath.includes('..') || path.isAbsolute(docPath)) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    // Read from docs directory
    const fullPath = path.join(process.cwd(), 'docs', docPath + '.md')
    const content = await readFile(fullPath, 'utf8')

    return new Response(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Error reading markdown file:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
