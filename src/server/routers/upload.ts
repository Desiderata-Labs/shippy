import { UPLOAD_FOLDERS } from '@/lib/uploads/folders'
import { getSignedUrl } from '@/lib/uploads/r2'
import { protectedProcedure, router } from '@/server/trpc'
import { z } from 'zod/v4'

export const uploadRouter = router({
  /**
   * Get a signed URL for uploading a file to R2
   * Returns a pre-signed PUT URL that the client can use to upload directly
   */
  getSignedUrl: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        folder: z.enum(UPLOAD_FOLDERS),
        contentType: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return await getSignedUrl({
        fileName: input.fileName,
        folder: input.folder,
        contentType: input.contentType,
      })
    }),
})
