'use client'

import { trpc } from '@/lib/trpc/react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AttachmentReferenceType } from '@/lib/db/types'
import { UploadFolder } from '@/lib/uploads/folders'
import { $createTextNode, $getSelection, $isRangeSelection } from 'lexical'
import { toast } from 'sonner'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Image types that should render as images in markdown
const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
])

export interface UploadConfig {
  /** Reference type for attachment tracking */
  referenceType: AttachmentReferenceType
  /** ID of the entity (or pre-generated ID for pending entities) */
  referenceId: string
  /** Required for PENDING_SUBMISSION - the bounty being submitted to */
  bountyId?: string
  /** Required for PENDING_BOUNTY - the project the bounty belongs to */
  projectId?: string
}

interface FileDropPluginProps {
  /** Folder to upload files to */
  uploadFolder: UploadFolder
  /** Optional config for creating attachment records */
  uploadConfig?: UploadConfig
  /** Callback when upload starts */
  onUploadStart?: () => void
  /** Callback when all uploads complete */
  onUploadEnd?: () => void
}

/**
 * Overlay component shown when dragging images over the editor
 */
function DropOverlay({ targetElement }: { targetElement: HTMLElement }) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    // Find the outermost container - look for common wrapper patterns
    // Priority: data attribute > border container > editor container > grandparent
    const container =
      targetElement.closest('[data-file-drop-container]') ??
      targetElement.closest('.rounded-lg.border') ??
      targetElement.closest('[data-lexical-editor-container]') ??
      targetElement.parentElement?.parentElement ??
      targetElement
    const updateRect = () => {
      setRect(container.getBoundingClientRect())
    }
    updateRect()

    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    return () => {
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
    }
  }, [targetElement])

  if (!rect) return null

  return createPortal(
    <div
      className="pointer-events-none fixed z-50 flex items-center justify-center rounded-lg bg-white/5"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
    >
      <span className="text-sm text-muted-foreground">Drop to upload</span>
    </div>,
    document.body,
  )
}

/**
 * Plugin that handles drag-and-drop and paste uploads for files.
 * Inserts markdown syntax at the cursor position after upload completes.
 * Images are inserted as ![alt](url), other files as [filename](url).
 */
export function FileDropPlugin({
  uploadFolder,
  uploadConfig,
  onUploadStart,
  onUploadEnd,
}: FileDropPluginProps): React.ReactElement | null {
  const [editor] = useLexicalComposerContext()
  const uploadCountRef = useRef(0)
  const dragCounterRef = useRef(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const [rootElement, setRootElement] = useState<HTMLElement | null>(null)

  const getSignedUrl = trpc.upload.getSignedUrl.useMutation()
  const createAttachment = trpc.attachment.create.useMutation()

  // Track root element
  useEffect(() => {
    setRootElement(editor.getRootElement())
  }, [editor])

  const uploadFile = useCallback(
    async (file: File): Promise<{ url: string; fileName: string } | null> => {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File "${file.name}" is too large (max 10MB)`)
        return null
      }

      try {
        // Get signed URL
        const { signedUrl, publicUrl, key } = await getSignedUrl.mutateAsync({
          fileName: file.name,
          folder: uploadFolder,
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

        // Create attachment record if config provided
        if (uploadConfig) {
          await createAttachment.mutateAsync({
            referenceType: uploadConfig.referenceType,
            referenceId: uploadConfig.referenceId,
            fileName: file.name,
            fileUrl: publicUrl,
            fileKey: key,
            fileSize: file.size,
            contentType: file.type || 'application/octet-stream',
            ...(uploadConfig.bountyId && { bountyId: uploadConfig.bountyId }),
            ...(uploadConfig.projectId && {
              projectId: uploadConfig.projectId,
            }),
          })
        }

        return { url: publicUrl, fileName: file.name }
      } catch (error) {
        console.error('Upload error:', error)
        toast.error(`Failed to upload "${file.name}"`)
        return null
      }
    },
    [uploadFolder, uploadConfig, getSignedUrl, createAttachment],
  )

  const insertMarkdownForFile = useCallback(
    (url: string, fileName: string, contentType: string) => {
      const isImage = IMAGE_TYPES.has(contentType)
      // For images: ![alt](url)
      // For files: [filename](url)
      const markdown = isImage
        ? `![${fileName}](${url})`
        : `[${fileName}](${url})`

      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          selection.insertNodes([$createTextNode(markdown + ' ')])
        }
      })
    },
    [editor],
  )

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return

      uploadCountRef.current += files.length
      if (uploadCountRef.current === files.length) {
        onUploadStart?.()
      }

      // Process all files in parallel
      const results = await Promise.all(
        files.map(async (file) => {
          const result = await uploadFile(file)
          if (result) {
            insertMarkdownForFile(result.url, result.fileName, file.type)
          }
          return result
        }),
      )

      uploadCountRef.current -= files.length
      if (uploadCountRef.current === 0) {
        onUploadEnd?.()
      }

      const successCount = results.filter(Boolean).length
      if (successCount > 0) {
        toast.success(
          successCount === 1
            ? 'File uploaded'
            : `${successCount} files uploaded`,
        )
      }
    },
    [uploadFile, insertMarkdownForFile, onUploadStart, onUploadEnd],
  )

  useEffect(() => {
    const root = editor.getRootElement()
    if (!root) return

    const handleDrop = (event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.files || [])
      dragCounterRef.current = 0
      setIsDragOver(false)
      if (files.length > 0) {
        event.preventDefault()
        event.stopPropagation()
        handleFiles(files)
      }
    }

    const handleDragOver = (event: DragEvent) => {
      // Only prevent default if there are files being dragged
      if (event.dataTransfer?.types.includes('Files')) {
        event.preventDefault()
      }
    }

    const handleDragEnter = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) {
        event.preventDefault()
        dragCounterRef.current++
        if (dragCounterRef.current === 1) {
          setIsDragOver(true)
        }
      }
    }

    const handleDragLeave = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) {
        event.preventDefault()
        dragCounterRef.current--
        if (dragCounterRef.current === 0) {
          setIsDragOver(false)
        }
      }
    }

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return

      const files: File[] = []
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }

      if (files.length > 0) {
        event.preventDefault()
        handleFiles(files)
      }
    }

    root.addEventListener('drop', handleDrop)
    root.addEventListener('dragover', handleDragOver)
    root.addEventListener('dragenter', handleDragEnter)
    root.addEventListener('dragleave', handleDragLeave)
    root.addEventListener('paste', handlePaste)

    return () => {
      root.removeEventListener('drop', handleDrop)
      root.removeEventListener('dragover', handleDragOver)
      root.removeEventListener('dragenter', handleDragEnter)
      root.removeEventListener('dragleave', handleDragLeave)
      root.removeEventListener('paste', handlePaste)
    }
  }, [editor, handleFiles])

  // Render the overlay when dragging files over
  if (isDragOver && rootElement) {
    return <DropOverlay targetElement={rootElement} />
  }

  return null
}
