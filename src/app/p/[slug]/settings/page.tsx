'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { notFound, redirect } from 'next/navigation'
import { CommitmentMonths, PayoutFrequency } from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { AppBackground } from '@/components/layout/app-background'
import { ProjectForm, ProjectFormData } from '@/components/project/project-form'
import { toast } from 'sonner'

export default function ProjectSettingsPage() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const { data: session, isPending: sessionLoading } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  // Fetch project data
  const { data: project, isLoading: projectLoading } =
    trpc.project.getBySlug.useQuery(
      { slug: params.slug },
      { enabled: !!params.slug },
    )

  const utils = trpc.useUtils()

  const updateProject = trpc.project.update.useMutation({
    onSuccess: (updatedProject) => {
      toast.success('Project updated!')
      utils.project.getBySlug.invalidate({ slug: updatedProject.slug })
      router.push(routes.project.detail({ slug: updatedProject.slug }))
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Loading states
  if (sessionLoading || projectLoading) {
    return (
      <AppBackground>
        <div className="container flex max-w-2xl items-center justify-center px-4 py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AppBackground>
    )
  }

  // Auth check
  if (!session) {
    redirect(routes.auth.signIn())
  }

  // Project not found
  if (!project) {
    notFound()
  }

  // Check if user is the founder
  if (project.founderId !== session.user.id) {
    notFound()
  }

  const handleSubmit = async (data: ProjectFormData) => {
    setIsLoading(true)
    try {
      await updateProject.mutateAsync({
        id: project.id,
        name: data.name,
        // Only include slug if it changed
        ...(data.slug !== project.slug ? { slug: data.slug } : {}),
        tagline: data.tagline || undefined,
        description: data.description || undefined,
        websiteUrl: data.websiteUrl || null,
        discordUrl: data.discordUrl || null,
        // Only include reward pool updates if allowed
        ...(project.canEditRewardPool
          ? {
              poolPercentage: parseInt(data.poolPercentage),
              payoutFrequency: data.payoutFrequency,
              commitmentMonths: data.commitmentMonths,
            }
          : {}),
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    router.push(routes.project.detail({ slug: project.slug }))
  }

  // Helper to convert commitment months number to form value
  const getCommitmentMonthsValue = (
    months: number | undefined,
  ): CommitmentMonths => {
    if (months === 6) return CommitmentMonths.SIX_MONTHS
    if (months === 24) return CommitmentMonths.TWO_YEARS
    if (months === 36) return CommitmentMonths.THREE_YEARS
    return CommitmentMonths.ONE_YEAR // Default to 12
  }

  // Convert project data to form data format
  const initialData: ProjectFormData = {
    name: project.name,
    slug: project.slug,
    tagline: project.tagline ?? '',
    description: project.description ?? '',
    websiteUrl: project.websiteUrl ?? '',
    discordUrl: project.discordUrl ?? '',
    poolPercentage: project.rewardPool?.poolPercentage.toString() ?? '10',
    payoutFrequency:
      (project.rewardPool?.payoutFrequency as PayoutFrequency) ??
      PayoutFrequency.MONTHLY,
    commitmentMonths: getCommitmentMonthsValue(
      project.rewardPool?.commitmentMonths,
    ),
  }

  return (
    <AppBackground>
      <div className="container max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Project Settings
          </h1>
          <p className="mt-2 text-muted-foreground">
            Update your project details
          </p>
        </div>

        <ProjectForm
          mode="edit"
          initialData={initialData}
          currentSlug={project.slug}
          canEditRewardPool={project.canEditRewardPool}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </AppBackground>
  )
}
