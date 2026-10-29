'use server';

import { eq } from 'drizzle-orm';
import { isWithinGracePeriod, markAccountDeleted, restoreAccount } from '@/lib/account-deletion';
import { verifyUndoToken } from '@/lib/account-deletion/undo-token';
import { auth } from '@/lib/auth';
import { isEnvAdminEmail } from '@/lib/auth-env';
import { normalizeEmail } from '@/lib/auth-users';
import { db } from '@/lib/db';
import { users } from '@/lib/db/auth-schema';

/**
 * Account deletion server actions — #103 (D7c S4).
 *
 * Why: the user requests deletion from settings and may undo it within the
 * 30-day grace period; see `@/lib/account-deletion` for what each write does.
 * What: `requestAccountDeletion` needs a session, refuses admins, refuses a
 * confirmation email that does not match the account, and refuses a repeat
 * request. `undoAccountDeletion` needs no session: it takes the signed token
 * issued at the blocked sign-in. Every failure, including a thrown DB error,
 * returns `success: false`; success is reported only after the batch commits.
 * Test: `src/lib/account-deletion/__tests__/account-deletion.test.ts`
 */

export interface AccountDeletionResult {
  success: boolean;
  error?: string;
}

const GENERIC_ERROR = 'Something went wrong. Nothing was changed. Please try again.';

export async function requestAccountDeletion(input: {
  confirmEmail: string;
  keepRecipes: boolean;
}): Promise<AccountDeletionResult> {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, error: 'You must be signed in.' };

    const [user] = await db
      .select({
        email: users.email,
        isAdmin: users.is_admin,
        deletionRequestedAt: users.deletion_requested_at,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return { success: false, error: 'Account not found.' };

    // #103: an admin cannot delete their own account (no orphaned admin role).
    if (user.isAdmin || isEnvAdminEmail(user.email)) {
      return { success: false, error: 'Admin accounts cannot be deleted from settings.' };
    }
    if (user.deletionRequestedAt) {
      return { success: false, error: 'Deletion has already been requested for this account.' };
    }

    const typed = normalizeEmail(input.confirmEmail);
    if (!typed || typed !== normalizeEmail(user.email)) {
      return { success: false, error: 'The email you typed does not match your account email.' };
    }

    await markAccountDeleted(userId, input.keepRecipes === true, new Date());
    return { success: true };
  } catch (error) {
    // #103: fail closed — never report success for a failed write.
    console.error('[requestAccountDeletion] failed:', error);
    return { success: false, error: GENERIC_ERROR };
  }
}

export async function undoAccountDeletion(token: string): Promise<AccountDeletionResult> {
  try {
    const claims = verifyUndoToken(token);
    if (!claims) {
      return { success: false, error: 'This undo link is invalid or has expired. Sign in again.' };
    }

    const [user] = await db
      .select({ deletionRequestedAt: users.deletion_requested_at })
      .from(users)
      .where(eq(users.id, claims.userId))
      .limit(1);
    const requestedAt = user?.deletionRequestedAt;
    // #103: the token is bound to this exact request; a finished undo voids it.
    if (!requestedAt || requestedAt.getTime() !== claims.requestedAtMs) {
      return { success: false, error: 'There is no pending deletion to undo for this link.' };
    }
    if (!isWithinGracePeriod(requestedAt)) {
      return { success: false, error: 'The 30-day undo period for this account has ended.' };
    }

    await restoreAccount(claims.userId, requestedAt);
    return { success: true };
  } catch (error) {
    console.error('[undoAccountDeletion] failed:', error);
    return { success: false, error: GENERIC_ERROR };
  }
}
