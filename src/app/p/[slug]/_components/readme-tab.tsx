import { Globe01, MessageSquare01 } from '@untitled-ui/icons-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface ReadmeTabProps {
  project: {
    name: string
    description: string | null
    discordUrl: string | null
    websiteUrl: string | null
    rewardPool: {
      poolPercentage: number
      payoutFrequency: string
      commitmentEndsAt: Date
    } | null
  }
}

export function ReadmeTab({ project }: ReadmeTabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main Content */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>About {project.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {project.description ? (
              <div className="prose prose-neutral dark:prose-invert max-w-none">
                {/* TODO: Render markdown */}
                <p className="whitespace-pre-wrap">{project.description}</p>
              </div>
            ) : (
              <p className="text-muted-foreground italic">
                No description provided yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {project.websiteUrl && (
              <Button
                variant="outline"
                className="w-full cursor-pointer justify-start"
                asChild
              >
                <a
                  href={project.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Globe01 className="mr-2 size-4" />
                  Website
                </a>
              </Button>
            )}
            {project.discordUrl && (
              <Button
                variant="outline"
                className="w-full cursor-pointer justify-start"
                asChild
              >
                <a
                  href={project.discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageSquare01 className="mr-2 size-4" />
                  Discord
                </a>
              </Button>
            )}
            {!project.websiteUrl && !project.discordUrl && (
              <p className="text-sm text-muted-foreground">
                No links added yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* How the Pool Works */}
        {project.rewardPool && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How the Pool Works</CardTitle>
              <CardDescription>
                Earn points by completing bounties
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium">Reward Pool</p>
                <p className="text-muted-foreground">
                  {project.rewardPool.poolPercentage}% of{' '}
                  {project.rewardPool.payoutFrequency === 'MONTHLY'
                    ? 'monthly'
                    : 'quarterly'}{' '}
                  profit is shared with contributors
                </p>
              </div>
              <div>
                <p className="font-medium">How Points Work</p>
                <p className="text-muted-foreground">
                  Complete bounties to earn points. Each payout, the pool is
                  split proportionally based on your share of total points.
                </p>
              </div>
              <div>
                <p className="font-medium">Commitment Period</p>
                <p className="text-muted-foreground">
                  This pool runs through{' '}
                  {new Date(
                    project.rewardPool.commitmentEndsAt,
                  ).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
