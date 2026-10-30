/**
 * #167 (D26): create-if-missing for a user's `user_profiles` row, keyed by user id.
 *
 * Why: `favorites.user_id` references `user_profiles.user_id`, so every writer of
 * a favorite needs the profile first. The `ensureUserProfile` server action reads
 * the session; an API-key caller has no session, so the favorites core calls this
 * with the caller's user id instead.
 * What: returns the existing profile, or inserts one whose username is derived
 * from the optional identity (name > email prefix > user id) and made unique.
 * Concurrent first calls for one user all get the same row (insert is
 * `ON CONFLICT (user_id) DO NOTHING`, then re-select); a username taken by a
 * concurrent new user is retried with the next suffix. Returns null on any
 * other failure (logged), as the action always has.
 * Test: `src/lib/favorites/__tests__/favorites-core.test.ts`
 */

import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import {
  insertUserProfileSchema,
  type UserProfile,
  userProfiles,
} from '@/lib/db/user-discovery-schema';
import { isUniqueViolation } from '@/lib/utils/error-handling';

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

export async function ensureUserProfileFor(
  userId: string,
  identity: ProfileIdentity | null = null
): Promise<UserProfile | null> {
  try {
    const existingProfile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.user_id, userId))
      .limit(1);

    if (existingProfile.length > 0) {
      return existingProfile[0];
    }

    // #22: profile data comes from the Auth.js session (Google name, email,
    // image) instead of a Clerk Backend API lookup.
    // Priority: full name > email prefix > user id
    const fullName = identity?.name?.trim() || null;
    let username: string;
    if (fullName) {
      username = fullName.toLowerCase().replace(/\s+/g, '-');
    } else if (identity?.email) {
      username = identity.email.split('@')[0];
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
        profile_image_url: identity?.image || null,
        is_public: true, // Default to public
      });

      let inserted: UserProfile | undefined;
      try {
        [inserted] = await db
          .insert(userProfiles)
          .values(profileData)
          .onConflictDoNothing({ target: userProfiles.user_id })
          .returning();
      } catch (error) {
        if (isUniqueViolation(error)) continue; // username taken meanwhile
        throw error;
      }

      if (!inserted) {
        const [winner] = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.user_id, userId))
          .limit(1);
        if (winner) return winner;
        throw new Error(`user_profiles conflict for ${userId} but no row on re-select`);
      }

      revalidatePath('/profile/edit');
      revalidatePath(`/profile/${inserted.username}`);
      return inserted;
    }
    throw new Error(`no free username for ${userId} after ${USERNAME_ATTEMPTS} attempts`);
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    return null;
  }
}
