import { generateNanoId } from '@/lib/nanoid/server'
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner'
import mime from 'mime-types'
import 'server-only'

// Export R2 configuration for reuse
export const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME!
export const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!

export const r2Client = new S3Client({
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT_URL!,
  region: 'auto',
})

type GetSignedUrlOptions = {
  fileName: string
  folder: string
  contentType?: string
}

type GetSignedUrlResult = {
  signedUrl: string
  key: string
  publicUrl: string
}

export async function getSignedUrl({
  fileName,
  folder,
  contentType,
}: GetSignedUrlOptions): Promise<GetSignedUrlResult> {
  const Bucket = R2_BUCKET_NAME

  const extension = fileName.split('.').pop() || 'jpg'
  const mimeType =
    contentType || mime.lookup(extension) || 'application/octet-stream'
  const filename = `${generateNanoId()}.${extension}`
  const Key = `${folder}/${filename}`

  const putObjectCommand = new PutObjectCommand({
    Bucket,
    Key,
    ContentType: mimeType,
  })

  const signedUrl = await awsGetSignedUrl(r2Client, putObjectCommand, {
    expiresIn: 3600, // URL expires in 1 hour
  })

  const publicUrl = `${R2_PUBLIC_URL}/${Key}`

  return {
    signedUrl,
    key: Key,
    publicUrl,
  }
}

/**
 * Delete an object from R2 storage
 */
export async function deleteObject(key: string): Promise<void> {
  const deleteCommand = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })

  await r2Client.send(deleteCommand)
}
