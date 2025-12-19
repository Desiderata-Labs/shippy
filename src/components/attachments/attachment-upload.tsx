'use client'

import { trpc } from '@/lib/trpc/react'
import { File06, Trash03, Upload01 } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { AttachmentReferenceType } from '@/lib/db/types'
import { UploadFolder } from '@/lib/uploads/folders'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface AttachmentUploadProps {
  /**
   * For existing entities: BOUNTY or SUBMISSION
   * For new entities: PENDING_BOUNTY or PENDING_SUBMISSION
   */
  referenceType: AttachmentReferenceType
  /**
   * The ID of the entity (or pre-generated ID for pending entities)
   */
  referenceId: string
  /**
   * Required for PENDING_SUBMISSION - the bounty being submitted to
   * Used to validate the user has an active claim
   */
  bountyId?: string
  /**
   * Required for PENDING_BOUNTY - the project the bounty belongs to
   * Used to validate the user is the founder
   */
  projectId?: string
  disabled?: boolean
  className?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Map reference types to upload folders
function getUploadFolder(referenceType: AttachmentReferenceType): UploadFolder {
  switch (referenceType) {
    case AttachmentReferenceType.BOUNTY:
    case AttachmentReferenceType.PENDING_BOUNTY:
      return UploadFolder.BOUNTIES
    case AttachmentReferenceType.SUBMISSION:
    case AttachmentReferenceType.PENDING_SUBMISSION:
      return UploadFolder.SUBMISSIONS
    default:
      return UploadFolder.SUBMISSIONS
  }
}

export function AttachmentUpload({
  referenceType,
  referenceId,
  bountyId,
  projectId,
  disabled = false,
  className,
}: AttachmentUploadProps) {
  const [isUploading, setIsUploading] = useState(false)

  const utils = trpc.useUtils()

  const { data: attachments, isLoading: attachmentsLoading } =
    trpc.attachment.getByReference.useQuery(
      { referenceType, referenceId },
      { enabled: !!referenceId },
    )

  const getSignedUrl = trpc.upload.getSignedUrl.useMutation()
  const createAttachment = trpc.attachment.create.useMutation({
    onSuccess: () => {
      utils.attachment.getByReference.invalidate({ referenceType, referenceId })
    },
  })
  const deleteAttachment = trpc.attachment.delete.useMutation({
    onSuccess: () => {
      utils.attachment.getByReference.invalidate({ referenceType, referenceId })
      toast.success('Attachment deleted')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const folder = getUploadFolder(referenceType)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return

      setIsUploading(true)
      try {
        for (const file of acceptedFiles) {
          // Get signed URL
          const { signedUrl, publicUrl, key } = await getSignedUrl.mutateAsync({
            fileName: file.name,
            folder,
            contentType: file.type || 'application/octet-stream',
          })

          // Upload to R2
          const response = await fetch(signedUrl, {
            method: 'PUT',
            body: file,
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
            },
          })

          if (!response.ok) {
            throw new Error(`Upload failed for ${file.name}`)
          }

          // Create attachment record
          await createAttachment.mutateAsync({
            referenceType,
            referenceId,
            fileName: file.name,
            fileUrl: publicUrl,
            fileKey: key,
            fileSize: file.size,
            contentType: file.type || 'application/octet-stream',
            ...(bountyId && { bountyId }),
            ...(projectId && { projectId }),
          })
        }

        toast.success(
          acceptedFiles.length === 1
            ? 'File uploaded'
            : `${acceptedFiles.length} files uploaded`,
        )
      } catch (error) {
        console.error('Upload error:', error)
        toast.error('Failed to upload file(s)')
      } finally {
        setIsUploading(false)
      }
    },
    [
      referenceType,
      referenceId,
      bountyId,
      projectId,
      folder,
      getSignedUrl,
      createAttachment,
    ],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: disabled || isUploading,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  })

  const handleDelete = (id: string) => {
    deleteAttachment.mutate({ id })
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Existing attachments */}
      {attachmentsLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading attachments...
        </div>
      ) : attachments && attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <File06 className="size-4 shrink-0 text-muted-foreground" />
                <a
                  href={attachment.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-sm text-foreground hover:underline"
                >
                  {attachment.fileName}
                </a>
                <span className="shrink-0 text-xs text-muted-foreground">
                  ({formatFileSize(attachment.fileSize)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(attachment.id)}
                disabled={disabled || deleteAttachment.isPending}
                className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                title="Delete attachment"
              >
                {deleteAttachment.isPending &&
                deleteAttachment.variables?.id === attachment.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash03 className="size-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer items-center justify-center rounded-md px-4 py-2 transition-colors',
          isDragActive
            ? 'bg-primary/10'
            : 'text-muted-foreground hover:text-foreground',
          (disabled || isUploading) && 'cursor-not-allowed opacity-60',
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
          {isUploading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Uploading...
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Upload01 className="size-4" />
                {isDragActive
                  ? 'Drop files here'
                  : 'Drop files or click to upload (max 10MB)'}
              </div>
              <span className="text-xs text-muted-foreground/70">
                (note: attachments save automatically)
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
