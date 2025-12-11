'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  ArrowRight,
  Clock,
  MessageTextSquare02,
} from '@untitled-ui/icons-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { notFound, redirect } from 'next/navigation'
import { SubmissionStatus } from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import {
  AppCard,
  AppCardContent,
  AppCardDescription,
  AppCardHeader,
  AppCardTitle,
} from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Skeleton } from '@/components/ui/skeleton'

const statusConfig: Record<string, { label: string; color: string }> = {
  [SubmissionStatus.PENDING]: {
    label: 'Pending',
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  },
  [SubmissionStatus.NEEDS_INFO]: {
    label: 'Needs Info',
    color: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  },
}

export default function ProjectSubmissionsPage() {
  const params = useParams<{ slug: string }>()
  const { data: session, isPending: sessionLoading } = useSession()

  // Fetch project data
  const { data: project, isLoading: projectLoading } =
    trpc.project.getBySlug.useQuery(
      { slug: params.slug },
      { enabled: !!params.slug },
    )

  // Fetch pending submissions
  const { data: submissions, isLoading: submissionsLoading } =
    trpc.submission.pendingForProject.useQuery(
      { projectId: project?.id ?? '' },
      { enabled: !!project?.id },
    )

  // Loading states
  if (sessionLoading || projectLoading) {
    return (
      <AppBackground>
        <div className="container max-w-3xl px-4 py-8">
          <Skeleton className="mb-4 h-6 w-32" />
          <Skeleton className="mb-8 h-10 w-64" />
          <Skeleton className="h-48 w-full" />
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

  return (
    <AppBackground>
      <div className="container max-w-3xl px-4 py-8">
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
              <BreadcrumbPage>Submissions</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Pending Submissions
          </h1>
          <p className="mt-2 text-muted-foreground">
            Review work submitted by contributors
          </p>
        </div>

        {submissionsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : !submissions || submissions.length === 0 ? (
          <AppCard>
            <AppCardContent className="py-12 text-center">
              <div className="mx-auto flex max-w-xs flex-col items-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                  <Clock className="size-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold">
                  No pending submissions
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  When contributors submit work, it will appear here for review.
                </p>
              </div>
            </AppCardContent>
          </AppCard>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => {
              const status =
                statusConfig[submission.status] ||
                statusConfig[SubmissionStatus.PENDING]

              return (
                <Link
                  key={submission.id}
                  href={routes.project.submissionDetail({
                    slug: params.slug,
                    submissionId: submission.id,
                  })}
                  className="group block"
                >
                  <AppCard className="transition-all hover:ring-1 hover:ring-primary/20">
                    <AppCardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn('text-xs', status.color)}
                            >
                              {status.label}
                            </Badge>
                            {submission.messages.length > 0 && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MessageTextSquare02 className="size-3" />
                                {submission.messages.length}
                              </span>
                            )}
                          </div>
                          <AppCardTitle className="mt-2 text-base transition-colors group-hover:text-primary">
                            {submission.bounty.title}
                          </AppCardTitle>
                        </div>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100" />
                      </div>
                    </AppCardHeader>
                    <AppCardContent>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-6">
                          <AvatarImage
                            src={submission.user.image ?? undefined}
                          />
                          <AvatarFallback className="text-xs">
                            {submission.user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{submission.user.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(submission.createdAt).toLocaleDateString(
                            'en-US',
                            {
                              month: 'short',
                              day: 'numeric',
                            },
                          )}
                        </span>
                      </div>
                      <AppCardDescription className="mt-2 line-clamp-2">
                        {submission.description}
                      </AppCardDescription>
                    </AppCardContent>
                  </AppCard>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </AppBackground>
  )
}
