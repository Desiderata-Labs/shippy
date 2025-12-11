'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { notFound, redirect } from 'next/navigation'
import { routes } from '@/lib/routes'
import { BountyForm, BountyFormData } from '@/components/bounty/bounty-form'
import { AppBackground } from '@/components/layout/app-background'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { toast } from 'sonner'

export default function NewBountyPage() {
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

  const createBounty = trpc.bounty.create.useMutation({
    onSuccess: (bounty) => {
      toast.success('Bounty created!')
      utils.bounty.getByProject.invalidate({ projectId: project?.id })
      router.push(
        routes.project.bountyDetail({ slug: params.slug, bountyId: bounty.id }),
      )
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

  const handleSubmit = async (data: BountyFormData) => {
    setIsLoading(true)
    try {
      await createBounty.mutateAsync({
        projectId: project.id,
        title: data.title,
        description: data.description,
        points: data.points,
        tags: data.tags,
        claimMode: data.claimMode,
        claimExpiryDays: data.claimExpiryDays,
        maxClaims: data.maxClaims,
        evidenceDescription: data.evidenceDescription || undefined,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    router.push(routes.project.detail({ slug: project.slug }))
  }

  return (
    <AppBackground>
      <div className="container max-w-2xl px-4 py-8">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={routes.project.detail({ slug: params.slug })}>
                  {project.name}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>New Bounty</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Create Bounty</h1>
          <p className="mt-2 text-muted-foreground">
            Define a task for contributors to earn points
          </p>
        </div>

        <BountyForm
          mode="create"
          isLoading={isLoading}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </AppBackground>
  )
}
