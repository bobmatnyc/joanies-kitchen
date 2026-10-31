/**
 * #167 (D26): create-if-missing for a user's `user_profiles` row, keyed by user id.
 *
 * Why: `favorites.user_id` references `user_profiles.user_id`, so every writer of
 * a favorite needs the profile first. The `ensureUserProfile` server action reads
 * the session; an API-key caller has no session, so the favorites core calls this
 * with the caller's user id instead.
 * What: returns the existing profile, or inserts one whose username is derived
 * from the optional identity (name > email prefix > user id) and made unique.
 * #181: with no identity (API-key caller) the identity is read from the Auth.js
 * `users` row by id; no row or a failed lookup falls back to the user id.
 * Concurrent first calls for one user all get the same row (insert is
 * `ON CONFLICT (user_id) DO NOTHING`, then re-select); a username taken by a
 * concurrent new user is retried with the next suffix. Returns null on any
 * other failure (logged), as the action always has.
 * #210: an account with a pending deletion gets no new profile; the guard is in
 * the INSERT statement itself (`insertProfileUnlessPendingDeletion`).
 * Test: `src/lib/favorites/__tests__/favorites-core.test.ts`,
 * `src/lib/__tests__/profile-pending-deletion.test.ts`
 */

import { eq, getTableColumns, type SQL, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { authorNotPendingDeletion } from '@/lib/account-deletion';
import { db } from '@/lib/db';
import { users } from '@/lib/db/auth-schema';
import {
  insertUserProfileSchema,
  type NewUserProfile,
  type UserProfile,
  userProfiles,
} from '@/lib/db/user-discovery-schema';
import { isUniqueViolation } from '@/lib/utils/error-handling';

/** #210: the error profile writers return when the account has a pending deletion. */
export const PENDING_DELETION_PROFILE_ERROR =
  'Your account is scheduled for deletion, so you cannot change your profile. Cancel the deletion to change it again.';

/** #210: what `insertProfileUnlessPendingDeletion` did. */
export type GuardedProfileInsert = 'inserted' | 'conflict' | 'pending-deletion';

/**
 * #210: the guarded INSERT as one statement. A `user_id` conflict is ignored
 * when `ignoreUserIdConflict` is set, and raises 23505 otherwise.
 */
function guardedProfileInsertSql(
  values: NewUserProfile,
  ignoreUserIdConflict: boolean
): SQL {
  const columns = getTableColumns(userProfiles);
  const keys = (Object.keys(values) as Array<keyof NewUserProfile>).filter(
    (key) => values[key] !== undefined
  );
  const names = sql.join(
    keys.map((key) => sql.identifier(columns[key].name)),
    sql`, `
  );
  // INSERT ... SELECT gives a parameter no type, so each value is cast to its
  // column's type. The length is dropped: a cast to varchar(n) truncates.
  const cells = sql.join(
    keys.map((key) => {
      const column = columns[key];
      const type = column.getSQLType().replace(/\(\d+\)$/, '');
      return sql`${sql.param(values[key], column)}::${sql.raw(type)}`;
    }),
    sql`, `
  );
  const onConflict = ignoreUserIdConflict
    ? sql`ON CONFLICT (${sql.identifier(columns.user_id.name)}) DO NOTHING`
    : sql``;
  return sql`
    WITH allowed AS (
      SELECT 1 AS ok WHERE ${authorNotPendingDeletion(values.user_id)}
    ), inserted AS (
      INSERT INTO ${userProfiles} (${names})
      SELECT ${cells} FROM allowed
      ${onConflict}
      RETURNING 1
    )
    SELECT EXISTS (SELECT 1 FROM allowed) AS allowed, EXISTS (SELECT 1 FROM inserted) AS added
  `;
}

/**
 * Why: #210: a profile created during the deletion grace period is public and
 * undoes `markAccountDeleted`. A separate pre-check can pass just before the
 * request lands, so the check rides in the INSERT's own statement, as in #197
 * and #208.
 * What: inserts `values` unless `users.deletion_requested_at` is set for
 * `values.user_id` (ids with no `users` row pass). Answers `pending-deletion`
 * when refused, `inserted`, or `conflict` when an ignored `user_id` conflict
 * wrote nothing. Throws on any other DB error, including 23505.
 * Test: `src/lib/__tests__/profile-pending-deletion.test.ts`
 */
export async function insertProfileUnlessPendingDeletion(
  values: NewUserProfile,
  { ignoreUserIdConflict }: { ignoreUserIdConflict: boolean }
): Promise<GuardedProfileInsert> {
  const result = await db.execute(guardedProfileInsertSql(values, ignoreUserIdConflict));
  const row = (result.rows as unknown as Array<{ allowed: boolean; added: boolean }>)[0];
  if (!row?.allowed) return 'pending-deletion';
  return row.added ? 'inserted' : 'conflict';
}

/** Inserts tried before giving up when concurrent new users keep taking the chosen username. */
const USERNAME_ATTEMPTS = 5;

/** `base`, or `base-N` with the lowest N, that no profile uses (case-insensitive). */
async function freeUsername(base: string): Promise<string> {
  let candidate = base;
  for (let counter = 1; ; counter++) {
    const existing = await db
      .select({ username: userProfiles.username })
      .from(userProfiles)
      .where(eq(sql`LOWER(${userProfiles.username})`, candidate.toLowerCase()))
      .limit(1);
    if (existing.length === 0) return candidate;
    candidate = `${base}-${counter}`;
  }
}

/** Identity fields a new profile is named from; all optional. */
export interface ProfileIdentity {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/**
 * #181: name, email and image from the Auth.js `users` row; null when there is no
 * row or the lookup fails (logged), so profile creation falls back to `user-<id8>`.
 */
async function loadUserIdentity(userId: string): Promise<ProfileIdentity | null> {
  try {
    const [row] = await db
      .select({ name: users.name, email: users.email, image: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? null;
  } catch (error) {
    console.error('Error loading user identity for profile:', error);
    return null;
  }
}

/**
 * #210: what `ensureUserProfileStatus` found or did. `pending-deletion` means
 * the account has no profile and gets none until the deletion is cancelled.
 */
export type EnsureProfileResult =
  | { status: 'ready'; profile: UserProfile }
  | { status: 'pending-deletion' }
  | { status: 'failed' };

/** The profile, or null when there is none (pending deletion or failure). */
export async function ensureUserProfileFor(
  userId: string,
  identity: ProfileIdentity | null = null
): Promise<UserProfile | null> {
  const result = await ensureUserProfileStatus(userId, identity);
  return result.status === 'ready' ? result.profile : null;
}

/**
 * #210: `ensureUserProfileFor` with the reason when no profile comes back. An
 * existing profile is returned unchanged, so a pending account's hidden
 * profile stays as `markAccountDeleted` left it.
 */
export async function ensureUserProfileStatus(
  userId: string,
  identity: ProfileIdentity | null = null
): Promise<EnsureProfileResult> {
  try {
    const existingProfile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.user_id, userId))
      .limit(1);

    if (existingProfile.length > 0) {
      return { status: 'ready', profile: existingProfile[0] };
    }

    // #181: an API-key caller passes no identity; read it from the Auth.js `users`
    // row so the name derivation below is the same one the web path uses.
    const resolved = identity ?? (await loadUserIdentity(userId));

    // #22: profile data comes from the Auth.js session (Google name, email,
    // image).
    // Priority: full name > email prefix > user id
    const fullName = resolved?.name?.trim() || null;
    let username: string;
    if (fullName) {
      username = fullName.toLowerCase().replace(/\s+/g, '-');
    } else if (resolved?.email) {
      username = resolved.email.split('@')[0];
    } else {
      username = `user-${userId.slice(0, 8)}`;
    }

    // Clean username (remove special characters, ensure lowercase)
    username = username
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    // #167: the existence check above and the insert below can race with another
    // first-time call. A user_id conflict is absorbed by ON CONFLICT and answered
    // by re-selecting the winner's row; a username conflict (another new user took
    // the same name in between) picks the next free name and retries.
    for (let attempt = 0; attempt < USERNAME_ATTEMPTS; attempt++) {
      const finalUsername = await freeUsername(username);
      const profileData = insertUserProfileSchema.parse({
        user_id: userId,
        username: finalUsername,
        display_name: fullName || finalUsername,
        profile_image_url: resolved?.image || null,
        is_public: true, // Default to public
      });

      // #210: the pending-deletion guard is in this insert's own statement.
      let outcome: GuardedProfileInsert;
      try {
        outcome = await insertProfileUnlessPendingDeletion(profileData, {
          ignoreUserIdConflict: true,
        });
      } catch (error) {
        if (isUniqueViolation(error)) continue; // username taken meanwhile
        throw error;
      }

      if (outcome === 'pending-deletion') return { status: 'pending-deletion' };

      // The new row, or the concurrent winner's on a user_id conflict.
      const [profile] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.user_id, userId))
        .limit(1);
      if (!profile) {
        throw new Error(`user_profiles ${outcome} for ${userId} but no row on re-select`);
      }

      if (outcome === 'inserted') {
        revalidatePath('/profile/edit');
        revalidatePath(`/profile/${profile.username}`);
      }
      return { status: 'ready', profile };
    }
    throw new Error(`no free username for ${userId} after ${USERNAME_ATTEMPTS} attempts`);
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    return { status: 'failed' };
  }
}
