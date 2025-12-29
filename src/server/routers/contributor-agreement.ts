import { CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION } from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/zod'
import {
  acceptAgreement,
  checkAgreement,
  getAgreementDetails,
  getTemplate,
  listAcceptances,
  renderPreviewTemplate,
} from '../services/contributor-agreement'
import { protectedProcedure, publicProcedure, router } from '../trpc'
import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'

export const contributorAgreementRouter = router({
  /**
   * Check if the current user has a valid agreement for a project
   */
  check: protectedProcedure
    .input(z.object({ projectId: nanoId() }))
    .query(async ({ ctx, input }) => {
      return checkAgreement(ctx.prisma, input.projectId, ctx.user.id)
    }),

  /**
   * Get the rendered agreement template for a project (for display in modal)
   * This is a public procedure since we want to show the agreement before claiming
   */
  getTemplate: publicProcedure
    .input(z.object({ projectId: nanoId() }))
    .query(async ({ ctx, input }) => {
      const result = await getTemplate({
        prisma: ctx.prisma,
        projectId: input.projectId,
        contributorName: ctx.user?.name || undefined,
        contributorEmail: ctx.user?.email || undefined,
      })

      if (!result.success) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: result.message,
        })
      }

      return {
        markdown: result.markdown,
        projectCustomTerms: result.projectCustomTerms,
        standardTemplateVersion: result.standardTemplateVersion,
        projectTermsVersion: result.projectTermsVersion,
        termsEnabled: result.termsEnabled,
        metadata: result.metadata,
      }
    }),

  /**
   * Accept the contributor agreement for a project
   */
  accept: protectedProcedure
    .input(
      z.object({
        projectId: nanoId(),
        checkboxes: z.object({
          readAndAgree: z.literal(true, {
            error: 'You must agree to the terms',
          }),
          understandBinding: z.literal(true, {
            error: 'You must acknowledge this is a binding agreement',
          }),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await acceptAgreement({
        prisma: ctx.prisma,
        projectId: input.projectId,
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        userName: ctx.user.name,
        ipAddress: ctx.ipAddress ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
      })

      if (!result.success) {
        if (result.code === 'PROJECT_NOT_FOUND') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: result.message,
          })
        }
        if (result.code === 'ALREADY_ACCEPTED') {
          // This is not an error - just return success
          return { success: true, alreadyAccepted: true }
        }
      }

      return {
        success: true,
        agreementId: result.success ? result.agreementId : undefined,
      }
    }),

  /**
   * Get the user's accepted agreement details for a project
   */
  getMyAgreement: protectedProcedure
    .input(z.object({ projectId: nanoId() }))
    .query(async ({ ctx, input }) => {
      const agreement = await getAgreementDetails(
        ctx.prisma,
        input.projectId,
        ctx.user.id,
      )

      if (!agreement) {
        return null
      }

      return {
        id: agreement.id,
        standardTemplateVersion: agreement.standardTemplateVersion,
        projectTermsVersion: agreement.projectTermsVersion,
        acceptedAt: agreement.acceptedAt,
      }
    }),

  /**
   * Get list of contributors who have accepted the agreement (founder only)
   */
  listAcceptances: protectedProcedure
    .input(
      z.object({
        projectId: nanoId(),
        limit: z.number().min(1).max(100).default(50),
        cursor: nanoId().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await listAcceptances({
        prisma: ctx.prisma,
        projectId: input.projectId,
        userId: ctx.user.id,
        limit: input.limit,
        cursor: input.cursor,
      })

      if (!result.success) {
        throw new TRPCError({
          code: result.code === 'PROJECT_NOT_FOUND' ? 'NOT_FOUND' : 'FORBIDDEN',
          message: result.message,
        })
      }

      return {
        agreements: result.agreements,
        nextCursor: result.nextCursor,
      }
    }),

  /**
   * Get the current template version (for cache busting)
   */
  getVersion: publicProcedure.query(() => ({
    standardTemplateVersion: CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION,
  })),

  /**
   * Preview the agreement template with provided settings (for project editor)
   */
  preview: protectedProcedure
    .input(
      z.object({
        projectName: z.string(),
        projectSlug: z.string().optional(),
        projectOwnerLegalName: z.string(),
        projectOwnerContactEmail: z.string(),
        projectOwnerRepresentativeName: z.string().nullish(),
        projectOwnerRepresentativeTitle: z.string().nullish(),
        governingLaw: z.string().nullish(),
        forumSelection: z.string().nullish(),
        customTerms: z.string().nullish(),
        poolExpirationNoticeDays: z.number().optional(),
        rewardPoolCommitmentEndsAt: z.date().nullish(),
      }),
    )
    .query(async ({ input }) => {
      const markdown = await renderPreviewTemplate({
        projectName: input.projectName,
        projectSlug: input.projectSlug,
        projectOwnerLegalName: input.projectOwnerLegalName,
        projectOwnerContactEmail: input.projectOwnerContactEmail,
        projectOwnerRepresentativeName: input.projectOwnerRepresentativeName,
        projectOwnerRepresentativeTitle: input.projectOwnerRepresentativeTitle,
        governingLaw: input.governingLaw,
        forumSelection: input.forumSelection,
        customTerms: input.customTerms,
        poolExpirationNoticeDays: input.poolExpirationNoticeDays,
        rewardPoolCommitmentEndsAt: input.rewardPoolCommitmentEndsAt,
      })

      return { markdown }
    }),
})
