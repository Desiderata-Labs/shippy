import { routes } from '@/lib/routes'
import { DOCS } from '@/../docs/config'
import 'server-only'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://shippy.sh'

function generateLlmsTxt(): string {
  const lines: string[] = []

  // H1 - Required
  lines.push('# Shippy')
  lines.push('')

  // Blockquote with short summary
  lines.push(
    '> Shippy is a platform where founders "open-source" parts of their startup by posting real work (growth, marketing, sales, etc.), and contributors who help ship it earn an ongoing share of the upside—not just a one-off payment.',
  )
  lines.push('')

  // Details about the project
  lines.push(
    'Contributors earn recurring royalties for helping startups ship real work. Founders create projects with reward pools, publish bounties with point rewards, and contributors who complete bounties earn points that convert into recurring payouts proportional to their share of the pool.',
  )
  lines.push('')

  // Important Links
  lines.push('## Links')
  lines.push('')
  lines.push(
    `- [Homepage](${APP_URL}${routes.llmsTxt.doc('shippy')}): Main marketing page explaining Shippy's value proposition`,
  )
  lines.push('')

  // Docs section
  lines.push('## Docs')
  lines.push('')

  for (const doc of DOCS) {
    const docUrl = `${APP_URL}${routes.llmsTxt.doc(doc.id)}`
    lines.push(`- [${doc.title}](${docUrl}): ${doc.description}`)
  }
  lines.push('')

  return lines.join('\n')
}

export async function GET() {
  const content = generateLlmsTxt()

  return new Response(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  })
}
