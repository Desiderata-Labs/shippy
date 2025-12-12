'use client'

import { trpc } from '@/lib/trpc/react'
import { BountyStatus, BountyTag } from '@/lib/db/types'
import {
  BountyForm,
  type BountyFormData,
} from '@/components/bounty/bounty-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface EditBountyModalProps {
  open: boolean
  onClose: () => void
  bounty: {
    id: string
    title: string
    description: string
    points: number
    tags: string[]
    status: string
    claimMode: string
    claimExpiryDays: number
    maxClaims?: number | null
    evidenceDescription: string | null
  }
  onSuccess?: () => void
}

export function EditBountyModal({
  open,
  onClose,
  bounty,
  onSuccess,
}: EditBountyModalProps) {
  const utils = trpc.useUtils()

  const updateBounty = trpc.bounty.update.useMutation({
    onSuccess: () => {
      toast.success('Bounty updated')
      utils.bounty.getById.invalidate({ id: bounty.id })
      onSuccess?.()
      onClose()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = async (data: BountyFormData) => {
    await updateBounty.mutateAsync({
      id: bounty.id,
      title: data.title,
      description: data.description,
      points: data.points,
      tags: data.tags,
      status: bounty.status as BountyStatus, // Keep current status
      evidenceDescription: data.evidenceDescription || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Bounty</DialogTitle>
          <DialogDescription>
            Make changes to this bounty. All edits are tracked for transparency.
          </DialogDescription>
        </DialogHeader>

        <BountyForm
          mode="edit"
          initialData={{
            title: bounty.title,
            description: bounty.description,
            points: bounty.points,
            tags: bounty.tags as BountyTag[],
            claimMode: bounty.claimMode as BountyFormData['claimMode'],
            claimExpiryDays: bounty.claimExpiryDays,
            maxClaims: bounty.maxClaims ?? undefined,
            evidenceDescription: bounty.evidenceDescription ?? '',
          }}
          isLoading={updateBounty.isPending}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
