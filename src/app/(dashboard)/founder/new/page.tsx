'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PayoutFrequency, ProfitBasis } from '@/lib/db/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export default function NewProjectPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [discordUrl, setDiscordUrl] = useState('')
  const [poolPercentage, setPoolPercentage] = useState('10')
  const [payoutFrequency, setPayoutFrequency] = useState<PayoutFrequency>(
    PayoutFrequency.MONTHLY,
  )
  const [commitmentMonths, setCommitmentMonths] = useState<
    '6' | '12' | '24' | '36'
  >('12')

  const createProject = trpc.project.create.useMutation({
    onSuccess: (project) => {
      toast.success('Project created!')
      router.push(`/project/${project.slug}`)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value)
    const generatedSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    setSlug(generatedSlug)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) {
      toast.error('You must be logged in')
      return
    }

    setIsLoading(true)
    try {
      await createProject.mutateAsync({
        name,
        slug,
        tagline: tagline || undefined,
        description: description || undefined,
        websiteUrl: websiteUrl || undefined,
        discordUrl: discordUrl || undefined,
        poolPercentage: parseInt(poolPercentage),
        payoutFrequency,
        profitBasis: ProfitBasis.NET_PROFIT,
        commitmentMonths,
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!session) {
    router.push('/sign-in')
    return null
  }

  return (
    <div className="container max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Create New Project
        </h1>
        <p className="mt-2 text-muted-foreground">
          Set up your project and reward pool to attract contributors
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              Basic information about your project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="My Awesome Startup"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  earnaslice.com/project/
                </span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="my-startup"
                  pattern="^[a-z0-9-]+$"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="A short description of your project"
                maxLength={200}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell potential contributors about your project, mission, and how they can help..."
                rows={5}
                disabled={isLoading}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Website URL</Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discordUrl">Discord URL</Label>
                <Input
                  id="discordUrl"
                  type="url"
                  value={discordUrl}
                  onChange={(e) => setDiscordUrl(e.target.value)}
                  placeholder="https://discord.gg/..."
                  disabled={isLoading}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reward Pool */}
        <Card>
          <CardHeader>
            <CardTitle>Reward Pool</CardTitle>
            <CardDescription>
              Configure how contributors will earn from your project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="poolPercentage">Pool Percentage *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="poolPercentage"
                  type="number"
                  min="1"
                  max="100"
                  value={poolPercentage}
                  onChange={(e) => setPoolPercentage(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  % of net profit goes to contributors
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Example: If you set 10% and make $10,000 profit, $1,000 goes to
                the pool
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payoutFrequency">Payout Frequency *</Label>
              <Select
                value={payoutFrequency}
                onValueChange={(v: PayoutFrequency) => setPayoutFrequency(v)}
                disabled={isLoading}
              >
                <SelectTrigger id="payoutFrequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PayoutFrequency.MONTHLY}>
                    Monthly
                  </SelectItem>
                  <SelectItem value={PayoutFrequency.QUARTERLY}>
                    Quarterly
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commitmentMonths">Commitment Period *</Label>
              <Select
                value={commitmentMonths}
                onValueChange={(v: '6' | '12' | '24' | '36') =>
                  setCommitmentMonths(v)
                }
                disabled={isLoading}
              >
                <SelectTrigger id="commitmentMonths">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 months</SelectItem>
                  <SelectItem value="12">1 year</SelectItem>
                  <SelectItem value="24">2 years</SelectItem>
                  <SelectItem value="36">3 years</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How long you commit to running the reward pool. Contributors see
                this before claiming bounties.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isLoading}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="cursor-pointer">
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create Project
          </Button>
        </div>
      </form>
    </div>
  )
}
