import { readFile } from 'node:fs/promises'
import path from 'node:path'
import 'server-only'

export async function readLegalMarkdown(doc: 'terms' | 'privacy') {
  const filePath = path.join(process.cwd(), 'legal', `${doc}.md`)
  return readFile(filePath, 'utf8')
}
