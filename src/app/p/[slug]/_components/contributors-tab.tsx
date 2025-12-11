'use client'

import { trpc } from '@/lib/trpc/react'
import { CoinsStacked01, Users01 } from '@untitled-ui/icons-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface ContributorsTabProps {
  projectId: string
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function ContributorsTab({ projectId }: ContributorsTabProps) {
  const { data, isLoading, error } = trpc.contributor.getByProject.useQuery({
    projectId,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contributors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">Failed to load contributors.</p>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.contributors.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Users01 className="mb-4 size-12 text-muted-foreground" />
          <h3 className="text-xl font-semibold">No contributors yet</h3>
          <p className="mt-2 max-w-sm text-muted-foreground">
            Contributors are added automatically when their submissions are
            approved. Be the first!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Contributors ({data.contributors.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            Total: {data.totalPoints.toLocaleString()} points
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {data.contributors.map((contributor, index) => (
            <div
              key={contributor.userId}
              className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div className="w-6 text-center text-sm font-medium text-muted-foreground">
                #{index + 1}
              </div>
              <Avatar className="size-10">
                <AvatarImage src={contributor.userImage ?? undefined} />
                <AvatarFallback>
                  {contributor.userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{contributor.userName}</p>
                <p className="text-sm text-muted-foreground">
                  {contributor.points.toLocaleString()} points (
                  {contributor.sharePercent.toFixed(1)}%)
                </p>
              </div>
              {contributor.lifetimeEarningsCents > 0 && (
                <div className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                  <CoinsStacked01 className="size-4" />
                  {formatCurrency(contributor.lifetimeEarningsCents)}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
