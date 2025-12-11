'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { useState } from 'react'
import { redirect, useParams, useRouter } from 'next/navigation'
import { ProfitBasis } from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { AppBackground } from '@/components/layout/app-background'
import { ProjectForm, ProjectFormData } from '@/components/project/project-form'
import { toast } from 'sonner'

export default function NewProjectPage() {
  const router = useRouter()
  const params = useParams<{ username: string }>()
  const { data: session, isPending: sessionLoading } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  const createProject = trpc.project.create.useMutation({
    onSuccess: (project) => {
      toast.success('Project created!')
      router.push(routes.project.detail({ slug: project.slug }))
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Check if viewing own profile
  const username = (session?.user as { username?: string })?.username
  const isOwnProfile = username === params.username

  if (sessionLoading) {
    return null
  }

  if (!session) {
    redirect(routes.auth.signIn())
  }

  // Only allow creating projects on own profile
  if (!isOwnProfile) {
    if (username) {
      redirect(routes.user.newProject({ username }))
    }
    redirect(routes.dashboard.root())
  }

  const handleSubmit = async (data: ProjectFormData) => {
    if (!session) {
      toast.error('You must be logged in')
      return
    }

    setIsLoading(true)
    try {
      await createProject.mutateAsync({
        name: data.name,
        slug: data.slug,
        tagline: data.tagline || undefined,
        description: data.description || undefined,
        websiteUrl: data.websiteUrl || undefined,
        discordUrl: data.discordUrl || undefined,
        poolPercentage: parseInt(data.poolPercentage),
        payoutFrequency: data.payoutFrequency,
        profitBasis: ProfitBasis.NET_PROFIT,
        commitmentMonths: data.commitmentMonths,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    router.back()
  }

  return (
    <AppBackground>
      <div className="container max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Create New Project
          </h1>
          <p className="mt-2 text-muted-foreground">
            Set up your project and reward pool to attract contributors
          </p>
        </div>

        <ProjectForm
          mode="create"
          isLoading={isLoading}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </AppBackground>
  )
}
