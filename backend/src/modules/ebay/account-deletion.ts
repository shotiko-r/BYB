import { createHash } from 'node:crypto';
import { z } from 'zod';

// Exact URL entered in eBay's portal. Never reconstruct it from request headers.
export const ACCOUNT_DELETION_ENDPOINT = 'https://byb-backend.usectl.com/api/ebay/account-deletion';
export const VerificationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32,80}$/, 'Invalid marketplace deletion verification token');

const identifier = z.string().min(1).max(2048);
export const AccountDeletionNotificationSchema = z.object({
  metadata: z.object({
    topic: z.literal('MARKETPLACE_ACCOUNT_DELETION'),
    schemaVersion: z.literal('1.0'),
    deprecated: z.boolean().optional(),
  }),
  notification: z.object({
    notificationId: identifier,
    eventDate: z.string().datetime({ offset: true }),
    publishDate: z.string().datetime({ offset: true }),
    publishAttemptCount: z.number().int().positive(),
    data: z.object({
      username: identifier.optional(),
      userId: identifier.optional(),
      eiasToken: identifier.optional(),
    }).refine(data => Boolean(data.username || data.userId || data.eiasToken), 'Missing account identifier'),
  }),
});

export function challengeResponse(challenge: string, verificationToken: string): string {
  return createHash('sha256').update(challenge, 'utf8').update(verificationToken, 'utf8')
    .update(ACCOUNT_DELETION_ENDPOINT, 'utf8').digest('hex');
}

// Current BYB writes no eBay account identifiers, user tokens or account mappings.
// Acknowledgement only: payload authenticity is NOT verified in this token-only
// implementation. Add verification before introducing account-related processing.
export function handleAccountDeletion(): 'no_associated_account_data_stored' {
  return 'no_associated_account_data_stored';
}
