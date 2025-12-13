import type { Metadata } from 'next'
import { prisma } from '@/lib/db/server'
import { extractNanoIdFromSlug } from '@/lib/nanoid/shared'
import { SubmissionDetailContent } from './_content'

interface SubmissionDetailPageProps {
  params: Promise<{ slug: string; submissionId: string }>
}

export async function generateMetadata({
  params,
}: SubmissionDetailPageProps): Promise<Metadata> {
  const { submissionId: submissionSlug } = await params
  const submissionId = extractNanoIdFromSlug(submissionSlug)

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      bounty: {
        select: { title: true },
      },
    },
  })

  if (!submission) {
    return { title: 'Submission Not Found' }
  }

  return {
    title: `Submission: ${submission.bounty.title}`,
  }
}

export default function SubmissionDetailPage() {
  return <SubmissionDetailContent />
}
