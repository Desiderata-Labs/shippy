'use client'

import { trpc } from '@/lib/trpc/react'
import { File01, Scale01 } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { AppButton } from '@/components/app'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Markdown } from '@/components/ui/markdown'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

interface ContributorAgreementModalProps {
  projectId: string
  projectName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccepted: () => void
}

export function ContributorAgreementModal({
  projectId,
  projectName,
  open,
  onOpenChange,
  onAccepted,
}: ContributorAgreementModalProps) {
  const [readAndAgree, setReadAndAgree] = useState(false)
  const [understandBinding, setUnderstandBinding] = useState(false)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)

  // Fetch the agreement template
  const { data: template, isLoading: templateLoading } =
    trpc.contributorAgreement.getTemplate.useQuery(
      { projectId },
      { enabled: open },
    )

  // Accept mutation
  const acceptMutation = trpc.contributorAgreement.accept.useMutation({
    onSuccess: () => {
      toast.success('Contributor agreement accepted')
      onAccepted()
      onOpenChange(false)
      // Reset state
      setReadAndAgree(false)
      setUnderstandBinding(false)
      setHasScrolledToBottom(false)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const handleAccept = () => {
    if (!readAndAgree || !understandBinding) return

    acceptMutation.mutate({
      projectId,
      checkboxes: {
        readAndAgree: true,
        understandBinding: true,
      },
    })
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const isAtBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 50
    if (isAtBottom) {
      setHasScrolledToBottom(true)
    }
  }

  const isValid = readAndAgree && understandBinding
  const isLoading = acceptMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl min-w-4xl overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Scale01 className="size-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                Contributor Agreement
              </DialogTitle>
              <DialogDescription>
                Review and accept the terms to contribute to {projectName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* Agreement content */}
        <div className="relative flex-1 overflow-hidden">
          {templateLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : template ? (
            <ScrollArea
              className="h-[400px] px-6"
              onScrollCapture={handleScroll}
            >
              <div className="py-4">
                <Markdown markdown={template.markdown} proseSize="sm" />

                {/* Project-specific custom terms */}
                {template.projectCustomTerms && (
                  <>
                    <Separator className="my-6" />
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <File01 className="size-4 text-muted-foreground" />
                        <h3 className="m-0 text-sm font-medium">
                          Additional Project Terms
                        </h3>
                      </div>
                      <Markdown
                        markdown={template.projectCustomTerms}
                        proseSize="sm"
                      />
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          ) : null}

          {/* Scroll indicator */}
          {!hasScrolledToBottom && !templateLoading && (
            <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-16 bg-linear-to-t from-background to-transparent" />
          )}
        </div>

        <Separator />

        {/* Acceptance checkboxes and button */}
        <div className="space-y-4 px-6 pt-4 pb-6">
          {/* Checkboxes */}
          <div className="space-y-3">
            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition-colors',
                readAndAgree
                  ? 'border-primary/50 bg-primary/5'
                  : 'hover:bg-muted/50',
              )}
            >
              <Checkbox
                checked={readAndAgree}
                onCheckedChange={(checked) => setReadAndAgree(checked === true)}
                disabled={isLoading}
                className="mt-0.5"
              />
              <div className="text-sm">
                <span className="font-medium">
                  I have read and agree to the terms
                </span>
                <p className="mt-0.5 text-muted-foreground">
                  I understand the IP assignment, payout terms, and my
                  responsibilities as an independent contractor.
                </p>
              </div>
            </label>

            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition-colors',
                understandBinding
                  ? 'border-primary/50 bg-primary/5'
                  : 'hover:bg-muted/50',
              )}
            >
              <Checkbox
                checked={understandBinding}
                onCheckedChange={(checked) =>
                  setUnderstandBinding(checked === true)
                }
                disabled={isLoading}
                className="mt-0.5"
              />
              <div className="text-sm">
                <span className="font-medium">
                  I understand this creates a binding legal agreement
                </span>
                <p className="mt-0.5 text-muted-foreground">
                  By accepting, I am entering into a legally binding agreement
                  with the project owner.
                </p>
              </div>
            </label>
          </div>

          {/* Accept button */}
          <div className="flex justify-end gap-3">
            <AppButton
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </AppButton>
            <AppButton
              type="button"
              onClick={handleAccept}
              disabled={!isValid || isLoading}
            >
              {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Accept & Continue
            </AppButton>
          </div>

          {/* Version info */}
          {template && (
            <p className="text-center text-xs text-muted-foreground">
              Standard template v{template.standardTemplateVersion} • Project
              terms v{template.projectTermsVersion}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
