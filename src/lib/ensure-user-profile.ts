/**
 * #167 (D26): create-if-missing for a user's `user_profiles` row, keyed by user id.
 *
 * Why: `favorites.user_id` references `user_profiles.user_id`, so every writer of
 * a favorite needs the profile first. The `ensureUserProfile` server action reads
 * the session; an API-key caller has no session, so the favorites core calls this
 * with the caller's user id instead.
 * What: returns the existing profile, or inserts one whose username is derived
 * from the optional identity (name > email prefix > user id) and made unique.
 * Returns null on failure (logged), as the action always has.
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

    // Ensure username is unique by appending numbers if needed
    let finalUsername = username;
    let counter = 1;
    let isUnique = false;

    while (!isUnique) {
      const existing = await db
        .select({ username: userProfiles.username })
        .from(userProfiles)
        .where(eq(sql`LOWER(${userProfiles.username})`, finalUsername.toLowerCase()))
        .limit(1);

      if (existing.length === 0) {
        isUnique = true;
      } else {
        finalUsername = `${username}-${counter}`;
        counter++;
      }
    }

    const profileData = insertUserProfileSchema.parse({
      user_id: userId,
      username: finalUsername,
      display_name: fullName || finalUsername,
      profile_image_url: identity?.image || null,
      is_public: true, // Default to public
    });

    const [newProfile] = await db.insert(userProfiles).values(profileData).returning();

    revalidatePath('/profile/edit');
    revalidatePath(`/profile/${newProfile.username}`);

    return newProfile;
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    return null;
  }
}
