'use client'

import { trpc } from '@/lib/trpc/react'
import { Scale01 } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { ContributorAgreementSettingsValue } from './contributor-agreement-settings'

export interface ContributorAgreementPreviewProps {
  projectName: string
  projectSlug?: string
  contributorAgreement: ContributorAgreementSettingsValue
  rewardPoolCommitmentEndsAt?: Date | null
}

export function ContributorAgreementPreview({
  projectName,
  projectSlug,
  contributorAgreement,
  rewardPoolCommitmentEndsAt,
}: ContributorAgreementPreviewProps) {
  const { data, isLoading, error } = trpc.contributorAgreement.preview.useQuery(
    {
      projectName,
      projectSlug,
      projectOwnerLegalName: contributorAgreement.projectOwnerLegalName,
      projectOwnerContactEmail: contributorAgreement.projectOwnerContactEmail,
      projectOwnerRepresentativeName:
        contributorAgreement.projectOwnerAuthorizedRepresentativeName,
      projectOwnerRepresentativeTitle:
        contributorAgreement.projectOwnerAuthorizedRepresentativeTitle,
      governingLaw: contributorAgreement.contributorTermsGoverningLaw,
      forumSelection: contributorAgreement.contributorTermsForumSelection,
      customTerms: contributorAgreement.contributorTermsCustom,
      rewardPoolCommitmentEndsAt,
    },
    {
      enabled: contributorAgreement.contributorTermsEnabled,
    },
  )

  if (!contributorAgreement.contributorTermsEnabled) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
        <Scale01 className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Contributor Agreement is currently disabled.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Enable it in the settings to see a preview.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-muted/30 p-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load preview: {error.message}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-accent">
      <div className="border-b border-border px-6 py-4">
        <h3 className="font-semibold">Agreement Preview</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          This is how the contributor agreement will appear to contributors
        </p>
      </div>
      <div className="max-h-[500px] overflow-y-auto p-6">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{data?.markdown ?? ''}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
