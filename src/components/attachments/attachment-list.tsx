'use client'

import { trpc } from '@/lib/trpc/react'
import { File06 } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { AttachmentReferenceType } from '@/lib/db/types'

interface AttachmentListProps {
  referenceType: AttachmentReferenceType
  referenceId: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentList({
  referenceType,
  referenceId,
}: AttachmentListProps) {
  const { data: attachments, isLoading } =
    trpc.attachment.getByReference.useQuery(
      { referenceType, referenceId },
      { enabled: !!referenceId },
    )

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading attachments...
      </div>
    )
  }

  if (!attachments || attachments.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground">Attachments</h4>
      <div className="space-y-1.5">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
          >
            <File06 className="size-4 shrink-0 text-muted-foreground" />
            <a
              href={attachment.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-sm text-foreground hover:underline"
            >
              {attachment.fileName}
            </a>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatFileSize(attachment.fileSize)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
