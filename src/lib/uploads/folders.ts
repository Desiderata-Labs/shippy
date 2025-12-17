/**
 * Upload folder paths for organizing files in R2 storage.
 * Each folder corresponds to a specific entity type.
 */
export enum UploadFolder {
  /** Project logos and branding assets */
  PROJECTS = 'projects',
  /** User profile avatars */
  USERS = 'users',
  /** Bounty-related attachments (future) */
  BOUNTIES = 'bounties',
  /** Submission evidence and attachments */
  SUBMISSIONS = 'submissions',
}

/** Array of all valid upload folders for Zod validation */
export const UPLOAD_FOLDERS = Object.values(UploadFolder) as [
  UploadFolder,
  ...UploadFolder[],
]
