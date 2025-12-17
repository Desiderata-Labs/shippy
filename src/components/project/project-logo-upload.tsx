'use client'

import { trpc } from '@/lib/trpc/react'
import { ImagePlus, Trash03, Upload01 } from '@untitled-ui/icons-react'
import { Check, Loader2, RotateCcw, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { UploadFolder } from '@/lib/uploads/folders'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface ProjectLogoUploadProps {
  /** Project ID - when provided, logo changes are auto-saved to DB */
  projectId?: string
  currentLogoUrl?: string | null
  onLogoChange: (url: string | null) => void
  disabled?: boolean
  className?: string
}

interface PendingImage {
  file: File
  objectUrl: string
  crop: Crop | undefined
  completedCrop: PixelCrop | undefined
  displayedWidth?: number
  displayedHeight?: number
}

export function ProjectLogoUpload({
  projectId,
  currentLogoUrl,
  onLogoChange,
  disabled = false,
  className,
}: ProjectLogoUploadProps) {
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const getSignedUrl = trpc.upload.getSignedUrl.useMutation()
  const updateLogo = trpc.project.updateLogo.useMutation()

  // Handle file drop/select
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setPendingImage({
      file,
      objectUrl: URL.createObjectURL(file),
      crop: undefined, // Start with no crop (full image selected)
      completedCrop: undefined,
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: disabled || isUploading,
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    accept: {
      'image/png': [],
      'image/jpeg': [],
      'image/webp': [],
    },
  })

  // Handle crop change
  const handleCropChange = useCallback((crop: Crop) => {
    setPendingImage((prev) => (prev ? { ...prev, crop } : null))
  }, [])

  // Handle crop complete
  const handleCropComplete = useCallback((crop: PixelCrop) => {
    if (!imgRef.current) return
    setPendingImage((prev) =>
      prev
        ? {
            ...prev,
            completedCrop: crop,
            displayedWidth: imgRef.current!.width,
            displayedHeight: imgRef.current!.height,
          }
        : null,
    )
  }, [])

  // Reset crop to full image
  const handleResetCrop = useCallback(() => {
    setPendingImage((prev) =>
      prev ? { ...prev, crop: undefined, completedCrop: undefined } : null,
    )
  }, [])

  // Cancel and close modal
  const handleCancel = useCallback(() => {
    if (pendingImage) {
      URL.revokeObjectURL(pendingImage.objectUrl)
    }
    setPendingImage(null)
  }, [pendingImage])

  // Upload the image (cropped or full)
  const handleConfirm = useCallback(async () => {
    if (!pendingImage) return

    setIsUploading(true)
    try {
      // Determine what to upload: cropped blob or original file
      let fileToUpload: Blob

      if (
        pendingImage.completedCrop &&
        pendingImage.displayedWidth &&
        pendingImage.displayedHeight &&
        pendingImage.completedCrop.width > 0 &&
        pendingImage.completedCrop.height > 0
      ) {
        // Crop was applied - create cropped blob
        fileToUpload = await getCroppedImageBlob(
          pendingImage.objectUrl,
          pendingImage.completedCrop,
          pendingImage.displayedWidth,
          pendingImage.displayedHeight,
        )
      } else {
        // No crop - use original file
        fileToUpload = pendingImage.file
      }

      // Get signed URL
      const { signedUrl, publicUrl } = await getSignedUrl.mutateAsync({
        fileName: 'logo.jpg',
        folder: UploadFolder.PROJECTS,
        contentType: 'image/jpeg',
      })

      // Upload to R2
      const response = await fetch(signedUrl, {
        method: 'PUT',
        body: fileToUpload,
        headers: {
          'Content-Type': 'image/jpeg',
        },
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      // Clean up
      URL.revokeObjectURL(pendingImage.objectUrl)
      setPendingImage(null)

      // Auto-save to DB if projectId is provided (edit mode)
      if (projectId) {
        await updateLogo.mutateAsync({ id: projectId, logoUrl: publicUrl })
      }

      // Update local state
      onLogoChange(publicUrl)
      toast.success('Logo uploaded successfully')
    } catch (error) {
      console.error('Failed to upload logo:', error)
      toast.error('Failed to upload logo')
    } finally {
      setIsUploading(false)
    }
  }, [pendingImage, getSignedUrl, projectId, updateLogo, onLogoChange])

  // Remove current logo
  const handleRemoveLogo = useCallback(async () => {
    // Auto-save to DB if projectId is provided (edit mode)
    if (projectId) {
      try {
        await updateLogo.mutateAsync({ id: projectId, logoUrl: null })
        toast.success('Logo removed')
      } catch (error) {
        console.error('Failed to remove logo:', error)
        toast.error('Failed to remove logo')
        return
      }
    }
    onLogoChange(null)
  }, [projectId, updateLogo, onLogoChange])

  return (
    <>
      {/* Dropzone / Current Logo Display */}
      <div className={cn('flex items-center gap-4', className)}>
        <div
          {...getRootProps()}
          className={cn(
            'relative flex size-20 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50',
            (disabled || isUploading) && 'cursor-not-allowed opacity-60',
          )}
        >
          <input {...getInputProps()} />
          {currentLogoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentLogoUrl}
                alt="Project logo"
                className="size-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
                <ImagePlus className="size-5 text-white" />
              </div>
            </>
          ) : (
            <Upload01 className="size-6 text-muted-foreground/50" />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {currentLogoUrl ? 'Change logo' : 'Add logo'}
          </span>
          <span className="text-xs text-muted-foreground">
            PNG, JPG or WEBP (max 10MB)
          </span>
          {currentLogoUrl && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              disabled={disabled || isUploading}
              className="mt-1 flex cursor-pointer items-center gap-1 text-xs text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash03 className="size-3" />
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Crop Modal */}
      <Dialog open={pendingImage !== null} onOpenChange={() => handleCancel()}>
        <DialogContent
          className="flex h-[80vh] max-h-[700px] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0"
          showCloseButton={false}
        >
          {/* Header */}
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Crop Logo</DialogTitle>
                <DialogDescription className="mt-1">
                  Drag to crop your logo or upload as-is
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancel}
                className="cursor-pointer rounded-full"
                disabled={isUploading}
              >
                <X className="size-5" />
              </Button>
            </div>
          </DialogHeader>

          {/* Crop Area */}
          <div className="relative flex flex-1 items-center justify-center overflow-auto bg-muted/50 p-4">
            {pendingImage && (
              <ReactCrop
                crop={pendingImage.crop}
                onChange={handleCropChange}
                onComplete={handleCropComplete}
                className="max-h-full max-w-full"
                aspect={1} // Square aspect ratio for logos
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={pendingImage.objectUrl}
                  alt="Crop preview"
                  className="max-h-[50vh] max-w-full object-contain"
                  style={{ display: 'block' }}
                />
              </ReactCrop>
            )}
          </div>

          {/* Footer Controls */}
          <div className="flex shrink-0 items-center justify-between border-t bg-background px-6 py-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleResetCrop}
                disabled={!pendingImage?.crop || isUploading}
                className="cursor-pointer"
                aria-label="Reset crop"
              >
                <RotateCcw className="size-4" />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isUploading}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isUploading}
                className="cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 size-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Helper function to create a cropped image blob from crop data
async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: PixelCrop,
  displayedWidth: number,
  displayedHeight: number,
): Promise<Blob> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('No 2d context')
  }

  // Calculate the scale between displayed size and actual image size
  const scaleX = image.naturalWidth / displayedWidth
  const scaleY = image.naturalHeight / displayedHeight

  // Scale the crop coordinates to actual image dimensions
  const actualX = Math.round(pixelCrop.x * scaleX)
  const actualY = Math.round(pixelCrop.y * scaleY)
  const actualWidth = Math.round(pixelCrop.width * scaleX)
  const actualHeight = Math.round(pixelCrop.height * scaleY)

  canvas.width = actualWidth
  canvas.height = actualHeight

  ctx.drawImage(
    image,
    actualX,
    actualY,
    actualWidth,
    actualHeight,
    0,
    0,
    actualWidth,
    actualHeight,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Canvas is empty'))
        }
      },
      'image/jpeg',
      0.95,
    )
  })
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.crossOrigin = 'anonymous'
    image.src = url
  })
}
